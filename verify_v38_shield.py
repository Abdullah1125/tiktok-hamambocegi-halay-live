import asyncio
import hashlib
import io
import json
import os
import re
import subprocess
import sys
import tempfile
import traceback

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

ROOT_DIR = r"c:\Users\pc\Documents\projelerim\TikTok_Halay_Live"
WEB_DIR = r"c:\Users\pc\Documents\projelerim\Tikoyun_Unpacked\halay_web"
SCREENSHOT_PATH = r"C:\Users\pc\.gemini\antigravity\brain\47617e3f-4006-4cf7-8a85-0491c3457aa2\v38_antiban_shield_verified.png"

if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

import ai_live_host  # noqa: E402
from tiktok_bridge import HalayLiveBridge  # noqa: E402


async def verify_ai_host() -> dict:
    results = {
        "fallback_tested": 0,
        "fallback_repeats": 0,
        "fallback_violations": [],
        "periodic_violations": [],
        "vip_line_violations": [],
        "tts_hash_1": "",
        "tts_hash_2": "",
        "tts_size_1": 0,
        "tts_size_2": 0,
        "tts_jitter_distinct": False,
        "tts_error": "",
    }

    events = []

    async def noop_bcast(payload):
        events.append(payload)

    async def noop_chat(text):
        return True

    host = ai_live_host.MultilingualAIHost(noop_bcast, noop_chat)
    host.room_snapshot_fn = lambda: {
        "dancers": 18,
        "likes": 2500,
        "viewers": 24,
        "song": "Urfa Düz",
        "roles": {
            "halaybasi": None,
            "davulcu": None,
            "zurnaci": None,
            "gelin": None,
            "damat": None,
        },
        "lang_scores": {"tr": 30, "en": 5, "ru": 8, "ar": 4},
    }

    langs = ["tr", "en", "ru", "ar", "es", "de", "fr", "az"]
    for lang in langs:
        prev = None
        for i in range(5):
            reply = ai_live_host.build_fallback_reply(lang, f"Misafir{i}", "katıl", True, 0, dancers=18)
            results["fallback_tested"] += 1
            if prev is not None and reply == prev:
                results["fallback_repeats"] += 1
            prev = reply
            if ai_live_host._SOLICITATION_BAN_RE.search(reply) or ai_live_host._TTS_ITEM_SCRUB_RE.search(reply):
                results["fallback_violations"].append((lang, reply))

    # Check periodic notice across several invocations
    for _ in range(8):
        plang, disp, speech = host._build_periodic_notice()
        if ai_live_host._SOLICITATION_BAN_RE.search(speech) or ai_live_host._TTS_ITEM_SCRUB_RE.search(speech):
            results["periodic_violations"].append((plang, speech))

    # Check VIP role lines
    for lang in langs:
        for role in ["halaybasi", "gelin", "damat", "davulcu", "zurnaci", "konfeti"]:
            line = host._build_vip_role_line(lang, "DenemeUser", role, "Rosa")
            if ai_live_host._SOLICITATION_BAN_RE.search(line) or ai_live_host._TTS_ITEM_SCRUB_RE.search(line):
                results["vip_line_violations"].append((lang, role, line))

    # Default voice_enabled is False in v40 (anti-synthetic-TTS shield); enable locally to test Edge-TTS jitter
    results["default_voice_enabled"] = bool(host.voice_enabled)
    try:
        host.voice_enabled = True
        sample = "Meydanda mendil havada, sahne sizin güzel dostlar!"
        u1 = await host._synthesize_tts("tr", sample)
        u2 = await host._synthesize_tts("tr", sample)
        id1 = u1.rsplit("/", 1)[-1].replace(".mp3", "") if u1 else ""
        id2 = u2.rsplit("/", 1)[-1].replace(".mp3", "") if u2 else ""
        b1 = host._tts_cache.get(id1, b"")
        b2 = host._tts_cache.get(id2, b"")
        results["tts_size_1"] = len(b1)
        results["tts_size_2"] = len(b2)
        results["tts_hash_1"] = hashlib.sha256(b1).hexdigest()[:16] if b1 else ""
        results["tts_hash_2"] = hashlib.sha256(b2).hexdigest()[:16] if b2 else ""
        results["tts_jitter_distinct"] = bool(b1 and b2 and len(b1) > 1000 and len(b2) > 1000 and b1 != b2)
    except Exception as exc:
        results["tts_error"] = f"{type(exc).__name__}: {exc}"

    return results


async def verify_bridge_logic() -> dict:
    emitted = []

    async def capture_bcast(payload):
        emitted.append(payload)

    bridge = HalayLiveBridge(capture_bcast)
    # Isolate cleanly from disk state and real room files
    bridge._save_active_room_state = lambda: None
    await bridge.reset_state()
    bridge._save_active_room_state = lambda: None
    bridge.user_cmd_cooldowns.clear()

    u_cum = {"uid": "u_cum", "nickname": "CumUser", "avatar": ""}
    u_konf = {"uid": "u_konf", "nickname": "KonfUser", "avatar": ""}
    u_free = {"uid": "u_free", "nickname": "FreeLiker", "avatar": ""}
    u_vipdj = {"uid": "u_vipdj", "nickname": "VipDj", "avatar": ""}
    u_team1 = {"uid": "u_team1", "nickname": "GelinKiz", "avatar": ""}
    u_team2 = {"uid": "u_team2", "nickname": "DamatBey", "avatar": ""}

    # 1. Cumulative diamonds: 10 + 10 = 20 (davulcu + dancer_vip), + 10 = 30 (halaybasi)
    await bridge.process_gift(u_cum, "Gül", 10, repeat_count=10)
    await bridge.process_gift(u_cum, "Gül", 10, repeat_count=10)
    d20 = bridge.user_round_diamonds.get("u_cum", 0)
    davul_uid = (bridge.davulcu_user or {}).get("uid")
    vip_after_20 = "u_cum" in bridge.dancer_vip

    await bridge.process_gift(u_cum, "Gül", 10, repeat_count=10)
    d30 = bridge.user_round_diamonds.get("u_cum", 0)
    halay_uid = (bridge.halaybasi_user or {}).get("uid")
    gift_pkts = [e for e in emitted if e.get("type") == "gift" and (e.get("user") or {}).get("uid") == "u_cum"]
    last_round_dia = gift_pkts[-1].get("round_diamonds") if gift_pkts else None

    # 2. 5..19 diamonds -> konfeti role
    await bridge.process_gift(u_konf, "Parmak Kalp", 5, repeat_count=1)
    konf_pkts = [e for e in emitted if e.get("type") == "gift" and (e.get("user") or {}).get("uid") == "u_konf"]
    konf_role = konf_pkts[-1].get("vip_role") if konf_pkts else None

    # 3. Free-like VIP DJ loophole closure: score >= 200 without VIP gift cannot trigger DJ request
    dj_calls = []

    async def fake_dj(nick, q, is_vip):
        dj_calls.append((nick, q, is_vip))
        return {"ok": True, "title": q}

    bridge.jukebox_request_fn = fake_dj
    bridge.supporter_points["u_free"] = {"uid": "u_free", "nickname": "FreeLiker", "avatar": "", "score": 350.0}
    await bridge.process_chat(u_free, "!istek Delilo")
    free_blocked = len(dj_calls) == 0

    # VIP gifter CAN queue
    bridge.dancer_vip.add("u_vipdj")
    bridge.supporter_points["u_vipdj"] = {"uid": "u_vipdj", "nickname": "VipDj", "avatar": "", "score": 25.0}
    await bridge.process_chat(u_vipdj, "!istek Delilo")
    vip_allowed = len(dj_calls) == 1

    # 4. '1' -> kadin + gelin, '2' -> erkek + damat
    await bridge.process_chat(u_team1, "1")
    bridge.user_cmd_cooldowns.pop("u_team2", None)
    await bridge.process_chat(u_team2, "2")

    team1 = bridge.user_teams.get("u_team1")
    team2 = bridge.user_teams.get("u_team2")
    c1 = [e.get("costume_gender") for e in emitted if e.get("type") == "chat" and (e.get("user") or {}).get("uid") == "u_team1"]
    c2 = [e.get("costume_gender") for e in emitted if e.get("type") == "chat" and (e.get("user") or {}).get("uid") == "u_team2"]

    return {
        "cum_20": d20,
        "davul_at_20": davul_uid == "u_cum",
        "vip_at_20": vip_after_20,
        "cum_30": d30,
        "halay_at_30": halay_uid == "u_cum",
        "ws_round_diamonds": last_round_dia,
        "konfeti_5_role": konf_role,
        "free_dj_blocked": free_blocked,
        "vip_dj_allowed": vip_allowed,
        "chat_1_team_costume": (team1, c1[-1] if c1 else None),
        "chat_2_team_costume": (team2, c2[-1] if c2 else None),
    }


def verify_static_hud() -> dict:
    with open(os.path.join(WEB_DIR, "index_local.html"), "r", encoding="utf-8") as f:
        html = f.read()
    with open(os.path.join(WEB_DIR, "local_sdk.js"), "r", encoding="utf-8") as f:
        js = f.read()

    has_v38 = "/local_sdk.js?v=38" in html
    has_pl_dj = "ch-pl-dj" in js
    has_ltr_pill = 'id="ch-audio-pill" dir="ltr"' in js
    has_ltr_txt = 'id="ch-audio-txt" dir="ltr"' in js

    # Evaluate HUD_I18N using Node in a temp file (PowerShell-safe)
    m = re.search(r"const HUD_I18N = (\{.*?\n  \});", js, flags=re.S)
    i18n_report = {"found": bool(m)}
    if m:
        snippet = (
            f"const HUD_I18N = {m.group(1)};\n"
            "const langs = Object.keys(HUD_I18N);\n"
            "const badHeart = [];\n"
            "const missingKeys = [];\n"
            "const missing1x = [];\n"
            "for (const l of langs) {\n"
            "  const p = HUD_I18N[l];\n"
            "  if (!p.emptyThrone || !p.emptySeat) missingKeys.push(l);\n"
            "  if (l === 'en') {\n"
            "    const flat = JSON.stringify(p);\n"
            "    if (/\\bheart\\b/i.test(flat)) badHeart.push(l);\n"
            "  }\n"
            "  if (!JSON.stringify(p).includes('1×') && !JSON.stringify(p).includes('1x')) missing1x.push(l);\n"
            "}\n"
            "console.log(JSON.stringify({langs, badHeart, missingKeys, missing1x}));\n"
        )
        with tempfile.NamedTemporaryFile("w", suffix=".js", encoding="utf-8", delete=False) as tf:
            tf.write(snippet)
            tmp_js = tf.name
        try:
            out = subprocess.check_output(["node", tmp_js], text=True, encoding="utf-8").strip()
            i18n_report.update(json.loads(out))
        finally:
            os.unlink(tmp_js)

    return {
        "index_v38": has_v38,
        "has_pl_dj": has_pl_dj,
        "has_ltr_pill": has_ltr_pill,
        "has_ltr_txt": has_ltr_txt,
        "i18n": i18n_report,
    }


async def verify_playwright_live() -> dict:
    from playwright.async_api import async_playwright
    import base64

    errors = []
    page_errors = []
    report = {}

    print("[STEP 4a] Launching Chromium...", flush=True)
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=[
                "--enable-webgl",
                "--ignore-gpu-blocklist",
                "--mute-audio",
                "--no-sandbox",
            ],
        )
        context = await browser.new_context(viewport={"width": 1080, "height": 1920}, device_scale_factor=1)
        page = await context.new_page()
        page.on("pageerror", lambda err: page_errors.append(str(err)))
        page.on("console", lambda msg: errors.append(msg.text) if msg.type == "error" else None)

        print("[STEP 4b] Navigating to http://127.0.0.1:9944/?obs=1&studio=obs...", flush=True)
        await page.goto("http://127.0.0.1:9944/?obs=1&studio=obs", wait_until="commit", timeout=25000)

        # Poll manually instead of wait_for_function (SwiftShader safe)
        ready = False
        for idx in range(40):
            await page.wait_for_timeout(500)
            state = await page.evaluate("""() => {
                const guide = document.querySelector('#ch-guide');
                const stage = document.querySelector('#halay-stage canvas');
                const pods = document.querySelector('.ch-pod-card');
                return !!(guide && stage && pods && document.querySelectorAll('#ch-guide .ch-pill').length === 5);
            }""")
            if state:
                ready = True
                print(f"[STEP 4c] DOM ready at poll {idx}", flush=True)
                break

        await page.wait_for_timeout(2000)
        print("[STEP 4d] Querying DOM metrics...", flush=True)

        dom_info = await page.evaluate("""() => {
            const pills = Array.from(document.querySelectorAll('#ch-guide .ch-pill')).map(el => ({
                id: el.id,
                text: el.textContent.trim(),
                rect: el.getBoundingClientRect().toJSON()
            }));
            const djPill = document.querySelector('#ch-pl-dj');
            const audioPill = document.querySelector('#ch-audio-pill');
            const audioTxt = document.querySelector('#ch-audio-txt');
            const throneCard = document.querySelector('.ch-pod-card.is-throne');
            const podCards = Array.from(document.querySelectorAll('.ch-pod-card')).map(c => ({
                cls: c.className,
                name: c.querySelector('.ch-pod-name')?.textContent?.trim() || '',
                role: c.querySelector('.ch-pod-role')?.textContent?.trim() || ''
            }));
            const hudEl = document.querySelector('#halay-cinema-hud');
            const topStrip = document.querySelector('#ch-top-strip');
            const showcaseBadges = Array.from(document.querySelectorAll('.ch-show-pill, .ch-gift-chip')).map(e => e.textContent.trim());
            const fullHudText = hudEl ? hudEl.innerText : '';
            let pillOverlap = false;
            for (let i = 0; i < pills.length - 1; i++) {
                if (pills[i].rect.right > pills[i+1].rect.left + 2) pillOverlap = true;
            }
            return {
                pillCount: pills.length,
                pillsText: pills.map(x => x.text),
                djPillText: djPill ? djPill.textContent.trim() : null,
                audioPillDir: audioPill ? audioPill.getAttribute('dir') : null,
                audioTxtDir: audioTxt ? audioTxt.getAttribute('dir') : null,
                throneClasses: throneCard ? throneCard.className : null,
                throneEmpty: throneCard ? throneCard.classList.contains('is-empty-seat') : null,
                podCards,
                pillOverlap,
                hasHeartWordInEn: /\\bheart\\b/i.test(fullHudText),
                topStripRect: topStrip ? topStrip.getBoundingClientRect().toJSON() : null,
                guideRect: document.querySelector('#ch-guide') ? document.querySelector('#ch-guide').getBoundingClientRect().toJSON() : null,
                canvasSize: (() => {
                    const c = document.querySelector('#halay-stage canvas');
                    return c ? {w: c.width, h: c.height, cw: c.clientWidth, ch: c.clientHeight} : null;
                })(),
                showcaseCount: showcaseBadges.length
            };
        }""")

        print("[DOM_JSON] " + json.dumps(dom_info, ensure_ascii=False), flush=True)
        print("[STEP 4e] Stopping window.halay.engine & capturing hardware-GPU screenshot...", flush=True)
        await page.evaluate("() => { window.halay?.engine?.renderer?.setPixelRatio?.(1); }")
        await page.wait_for_timeout(300)
        await page.evaluate("() => { window.halay?.engine?.stop?.(); }")
        await page.wait_for_timeout(150)

        try:
            await page.screenshot(path=SCREENSHOT_PATH, animations="disabled", timeout=15000)
            shot_mode = "playwright_hw"
        except Exception as exc:
            print(f"[STEP 4e] page.screenshot fallback ({exc}), using CDP...", flush=True)
            cdp = await context.new_cdp_session(page)
            res = await asyncio.wait_for(cdp.send("Page.captureScreenshot", {"format": "png"}), timeout=12.0)
            with open(SCREENSHOT_PATH, "wb") as f:
                f.write(base64.b64decode(res["data"]))
            shot_mode = "cdp_captureScreenshot"
        await page.evaluate("() => { window.halay?.engine?.start?.(); }")

        print(f"[STEP 4f] Screenshot captured via {shot_mode}", flush=True)
        await browser.close()

    report = {
        "ready": ready,
        "shot_mode": shot_mode,
        "screenshot_exists": os.path.exists(SCREENSHOT_PATH),
        "screenshot_bytes": os.path.getsize(SCREENSHOT_PATH) if os.path.exists(SCREENSHOT_PATH) else 0,
        "page_errors": page_errors,
        "console_errors": errors,
        "dom": dom_info,
    }
    return report


async def main():
    print("[STEP 1] Verifying static HUD & I18N...", flush=True)
    static_res = verify_static_hud()
    print("[STEP 2] Verifying MultilingualAIHost & Edge-TTS...", flush=True)
    ai_res = await asyncio.wait_for(verify_ai_host(), timeout=25.0)
    print("[STEP 3] Verifying HalayLiveBridge logic...", flush=True)
    bridge_res = await verify_bridge_logic()
    print("[PARTIAL_JSON] " + json.dumps({"static_hud": static_res, "ai_host": ai_res, "bridge_logic": bridge_res}, ensure_ascii=False), flush=True)
    print("[STEP 4] Verifying live 9:16 page with Playwright...", flush=True)
    pw_res = await asyncio.wait_for(verify_playwright_live(), timeout=90.0)

    out = {
        "static_hud": static_res,
        "ai_host": ai_res,
        "bridge_logic": bridge_res,
        "playwright_live": pw_res,
    }
    print(json.dumps(out, ensure_ascii=False, indent=2), flush=True)


if __name__ == "__main__":
    asyncio.run(main())
