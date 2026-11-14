import asyncio
import io
import os
import re
import sys
import time

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

BRIDGE_DIR = r"c:\Users\pc\Documents\projelerim\TikTok_Halay_Live"
ARTIFACT_PNG = r"C:\Users\pc\.gemini\antigravity\brain\47617e3f-4006-4cf7-8a85-0491c3457aa2\v45_arena_war_verified.png"

if BRIDGE_DIR not in sys.path:
    sys.path.insert(0, BRIDGE_DIR)

from tiktok_bridge import HalayLiveBridge  # noqa: E402


async def verify_backend() -> None:
    events = []

    async def cap_broadcast(payload):
        events.append(payload)

    bridge = HalayLiveBridge(broadcast_fn=cap_broadcast)
    bridge._save_active_room_state = lambda: None

    # Seed 5 dancers
    u_tr = {"uid": "u_tr", "nickname": "TurkLider", "avatar": "", "lang": "tr", "flag": "🇹🇷"}
    u_en = {"uid": "u_en", "nickname": "LondonKing", "avatar": "", "lang": "en", "flag": "🇬🇧"}
    u_d1 = {"uid": "u_d1", "nickname": "Misafir1", "avatar": "", "lang": "tr", "flag": "🇹🇷"}
    u_d2 = {"uid": "u_d2", "nickname": "Misafir2", "avatar": "", "lang": "tr", "flag": "🇹🇷"}
    for u in (u_tr, u_en, u_d1, u_d2):
        await bridge.queue_join(u, reason="test", flush_now=True)
    bridge.add_supporter_points(u_d1, 200.0)
    bridge.add_supporter_points(u_d2, 180.0)

    # 0. Likes never push viewers to front of halay line
    await bridge.process_like(u_d2, 1000)
    assert bridge._dancer_priority_score("u_d2") == 0.0, "Likes must not raise stage_order priority"
    order = bridge.get_stage_order()
    assert order.index("u_tr") < order.index("u_d2"), f"Expected u_tr ahead of liker u_d2, got {order}"

    # 1. Final 60s Clutch (3X multiplier)
    bridge.round_ends_at = time.time() + 45.0
    rs = bridge.get_round_state()
    assert rs["final_clutch_3x"] is True, f"Expected final_clutch_3x True, got {rs}"
    assert rs["score_mult"] == 3, f"Expected score_mult 3, got {rs}"

    # 2. Country Takeover + Sabotage shrink_rival (10 diamonds)
    bridge.halaybasi_user = dict(u_tr)
    await bridge.process_gift(u_en, "Siyah Gül", 10, gift_id=5655, diamond_unit=10)
    assert bridge.dominant_country == "en", f"Expected dominant_country='en', got {bridge.dominant_country}"
    assert any(e.get("type") == "country_takeover" and e.get("country") == "en" for e in events), "Missing country_takeover event"
    assert any(e.get("type") == "sabotage_fx" and e.get("action") == "shrink_rival" for e in events), "Missing shrink_rival sabotage_fx"
    assert "u_tr" in bridge.shrunk_until and "u_en" in bridge.giant_until, "Missing shrink/giant timers"

    # 3. Sabotage boot_back (30 diamonds)
    await bridge.process_gift(u_en, "Donut", 30, gift_id=5879, diamond_unit=30)
    assert any(e.get("type") == "sabotage_fx" and e.get("action") == "boot_back" for e in events), "Missing boot_back sabotage_fx"
    assert len(bridge.sabotage_penalty) >= 1, "Expected sabotage_penalty applied"

    # 4. Shared Mega Party Bar (party_meter >= 500 -> mega_party_burst)
    # Earlier 10*10*3 = 300, 30*10*3 = 900 -> already triggered! Let's also verify clean trigger from 490 -> 500+
    bridge.party_meter = 490
    bridge.party_active_until = 0.0
    events.clear()
    await bridge.process_chat(u_tr, "haydi halay")
    await bridge.process_gift(u_tr, "Gül", 1, gift_id=5655, diamond_unit=1)
    assert any(e.get("type") == "mega_party_burst" for e in events), "Missing mega_party_burst event"
    assert bridge.party_meter == 0, f"Expected party_meter reset to 0, got {bridge.party_meter}"
    assert bridge.party_patron and bridge.party_patron["uid"] == "u_tr", "Expected u_tr as party_patron"
    assert bridge.party_active_until > time.time(), "Expected party_active_until in future"

    # 5. Reigning Champions & AFK Sweep Immunity
    bridge.round_ends_at = time.time() - 1.0
    await bridge.check_and_advance_round()
    assert "u_en" in bridge.reigning_champions, f"Expected u_en in reigning_champions, got {bridge.reigning_champions}"
    removed = await bridge.sweep_inactive_dancers(now_ts=time.time() + 9999.0)
    removed_uids = {r["uid"] for r in removed}
    assert "u_en" not in removed_uids, "Reigning champion should be immune to AFK sweep"
    print("BACKEND_V45_ALL_PASS: 5/5 checks passed!")


async def verify_playwright_hud() -> None:
    from playwright.async_api import async_playwright

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(
            headless=True,
            args=["--enable-webgl", "--ignore-gpu-blocklist", "--mute-audio", "--no-sandbox"],
        )
        page = await browser.new_page(viewport={"width": 540, "height": 960})
        await page.goto("http://127.0.0.1:9944/", wait_until="domcontentloaded", timeout=20000)
        await page.wait_for_selector("#halay-cinema-hud", timeout=15000)
        await page.wait_for_timeout(1200)

        sdk_src = await page.evaluate("() => document.getElementById('tikoyun-sdk')?.getAttribute('src') || ''")
        assert "v=49" in sdk_src, f"Expected v=49 in tikoyun-sdk src, got {sdk_src}"

        # Drive TopDock state to verify FINAL 3X + Party Bar + Stealth Anti-Ban compliance
        await page.evaluate(
            """() => {
                if (window.__halayTopDock) {
                    window.__halayTopDock.setRoundState({
                        round_number: 3,
                        round_rem_sec: 42,
                        final_clutch_3x: true,
                        party_pct: 74,
                        party_patron: { nickname: 'LondonKing' },
                        party_active: false,
                        dominant_country: 'en'
                    });
                }
            }"""
        )
        await page.wait_for_timeout(50)

        hud_text = await page.evaluate("() => document.getElementById('halay-cinema-hud')?.innerText || ''")
        round_txt = await page.evaluate("() => document.getElementById('ch-round-pill')?.innerText || ''")
        party_txt = await page.evaluate("() => document.getElementById('ch-party-txt')?.innerText || ''")

        assert "FINAL 3X" in round_txt, f"Expected FINAL 3X in round pill, got {round_txt}"
        assert "Şölen %74" in party_txt and "LondonKing" in party_txt, f"Unexpected party bar text: {party_txt}"

        bad_coins = re.findall(r"(?<!\d)(?:10|20|30\+|199\+|1000|1×)(?!\d)", hud_text)
        bad_solicit = re.findall(r"(?:hediye|gift|100 beğeni)", hud_text, flags=re.IGNORECASE)
        assert not bad_coins, f"Stealth coin leak found in HUD: {bad_coins}"
        assert not bad_solicit, f"Stealth solicitation leak found in HUD: {bad_solicit}"

        await page.evaluate("() => window.halay?.engine?.stop?.()")
        await page.wait_for_timeout(200)
        cdp = await page.context.new_cdp_session(page)
        shot = await cdp.send("Page.captureScreenshot", {"format": "png"})
        import base64
        os.makedirs(os.path.dirname(ARTIFACT_PNG), exist_ok=True)
        with open(ARTIFACT_PNG, "wb") as f:
            f.write(base64.b64decode(shot["data"]))
        await browser.close()
        print(f"PLAYWRIGHT_V45_PASS: sdk={sdk_src} | round={round_txt} | party={party_txt} | badCoins={bad_coins} | badSolicit={bad_solicit}")


async def main() -> None:
    await verify_backend()
    # Wait briefly for :9944 daemon if just started
    import urllib.request
    for _ in range(15):
        try:
            with urllib.request.urlopen("http://127.0.0.1:9944/", timeout=2) as r:
                if r.status == 200:
                    break
        except Exception:
            await asyncio.sleep(0.5)
    await verify_playwright_hud()


if __name__ == "__main__":
    asyncio.run(main())
