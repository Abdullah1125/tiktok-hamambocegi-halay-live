import asyncio
import base64
import io
import json
import os
import re
import subprocess
import sys

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

SDK_PATH = r"c:\Users\pc\Documents\projelerim\Tikoyun_Unpacked\halay_web\local_sdk.js"
HTML_PATH = r"c:\Users\pc\Documents\projelerim\Tikoyun_Unpacked\halay_web\index_local.html"
SHOT_PATH = (
    r"C:\Users\pc\.gemini\antigravity\brain\47617e3f-4006-4cf7-8a85-0491c3457aa2\v44_stealth_hud_verified.png"
)

from ai_live_host import MultilingualAIHost


async def main():
    # 1. Verify auto_chat_enabled is False by default
    sent = []

    async def fake_bcast(_):
        pass

    async def fake_chat(txt):
        sent.append(txt)
        return True

    host = MultilingualAIHost(fake_bcast, fake_chat)
    assert host.auto_chat_enabled is False, "auto_chat_enabled must default to False!"
    await host.trigger_periodic_now()
    assert sent == [], f"Periodic notice unexpectedly posted to TikTok chat: {sent}"
    print("AI_HOST_AUTO_CHAT_OFF_OK")

    # 2. Audit HUD_I18N across all 8 languages for zero coin/gift solicitation text
    html = open(HTML_PATH, "r", encoding="utf-8").read()
    assert "/local_sdk.js?v=44" in html
    sdk_src = open(SDK_PATH, "r", encoding="utf-8").read()
    m_i18n = re.search(r"const HUD_I18N = (\{[\s\S]*?\n  \});", sdk_src)
    assert m_i18n
    node_script = (
        "const i18n = " + m_i18n.group(1) + ";\n"
        "const langs = Object.keys(i18n);\n"
        "const badCoins = [];\n"
        "const badSolicit = [];\n"
        "const missing24 = [];\n"
        "const fields = ['brideHint','groomHint','throneHint','djLockHint','bgLockHint','vipBumpHint','queueWaitHint','spotlights','menu'];\n"
        "for (const c of langs) {\n"
        "  const p = i18n[c] || {};\n"
        "  const sub = {};\n"
        "  for (const k of fields) sub[k] = p[k];\n"
        "  const blob = JSON.stringify(sub);\n"
        "  if (/1×|199\\+|30\\+|1000|100 beğeni|100 taps|100 likes|100 лайк/i.test(blob)) badCoins.push(c);\n"
        "  if (/hediye|\\bgift|подарок|هدية|regalo|geschenk|cadeau|hədiyyə/i.test(blob)) badSolicit.push(c);\n"
        "  if (!blob.includes('24')) missing24.push(c);\n"
        "}\n"
        "console.log(JSON.stringify({langs, badCoins, badSolicit, missing24}));\n"
    )
    res_node = subprocess.run(["node", "-e", node_script], capture_output=True, text=True, encoding="utf-8", check=True)
    audit = json.loads(res_node.stdout.strip())
    print("STEALTH_I18N_AUDIT:", json.dumps(audit, ensure_ascii=False))
    assert audit["badCoins"] == [], f"Coin/quota strings remain: {audit['badCoins']}"
    assert audit["badSolicit"] == [], f"Solicitation strings remain: {audit['badSolicit']}"
    assert audit["missing24"] == [], f"Missing 24-seat cue: {audit['missing24']}"

    # 3. Live :9944 Playwright check & screenshot
    from playwright.async_api import async_playwright

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=["--enable-webgl", "--ignore-gpu-blocklist", "--mute-audio", "--no-sandbox"],
        )
        ctx = await browser.new_context(viewport={"width": 540, "height": 960}, device_scale_factor=2)
        page = await ctx.new_page()
        page_errors = []
        page.on("pageerror", lambda e: page_errors.append(str(e)))
        await page.goto("http://127.0.0.1:9944/?obs=1&mode=916&dikey=1", wait_until="domcontentloaded", timeout=30000)
        await page.wait_for_function(
            "() => Boolean(document.getElementById('halay-cinema-hud') && window.__halayTopDock)",
            timeout=25000,
        )
        await asyncio.sleep(2.2)
        await page.evaluate("() => window.__halayTopDock.showPeriodicDjGuide(false)")
        await asyncio.sleep(0.35)
        snap = await page.evaluate(
            """() => ({
                sdkSrc: (Array.from(document.querySelectorAll('script[src]')).find(s => s.src.includes('local_sdk.js')) || {}).src || '',
                goalPill: document.getElementById('htd-goal-pill')?.textContent || '',
                showcase: Array.from(document.querySelectorAll('#ch-showcase .ch-sc-card')).slice(0, 3).map(el => el.textContent.trim()),
                subLine: document.querySelector('#halay-dj-subtitle #djs-line')?.textContent || '',
            })"""
        )
        snap["page_errors"] = page_errors
        print("LIVE_STEALTH_HUD:", json.dumps(snap, ensure_ascii=False))
        assert "/local_sdk.js?v=44" in snap["sdkSrc"]
        assert page_errors == []

        await page.evaluate("() => { if (window.halay?.engine?.stop) window.halay.engine.stop(); }")
        await asyncio.sleep(0.25)
        cdp = await ctx.new_cdp_session(page)
        shot = await cdp.send("Page.captureScreenshot", {"format": "png"})
        with open(SHOT_PATH, "wb") as f:
            f.write(base64.b64decode(shot["data"]))
        print(f"SHOT_SAVED: {SHOT_PATH} ({os.path.getsize(SHOT_PATH)} bytes)")
        await browser.close()
    print("\nALL V44 STEALTH CHECKS PASSED!")


if __name__ == "__main__":
    asyncio.run(main())
