# -*- coding: utf-8 -*-
from __future__ import annotations

import asyncio
import ipaddress
import json
import logging
from logging.handlers import RotatingFileHandler
import os
import re
import shutil
import socket
import subprocess
import sys
import threading
import time
import urllib.parse
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, Dict, Set

if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

from curl_cffi.requests import AsyncSession
from fastapi import FastAPI, Query, Request, Response, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
import uvicorn

from ai_live_host import MultilingualAIHost
from jukebox_service import HalayJukeboxService
from tiktok_bridge import HalayLiveBridge

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"
_LOCAL_WEB = BASE_DIR / "halay_web"
DIVALAR_DIR = _LOCAL_WEB if _LOCAL_WEB.exists() else (BASE_DIR.parent / "Tikoyun_Unpacked" / "halay_web")
DIVALAR_SETTINGS_FILE = BASE_DIR / "divalar_settings.json"
LOG_DIR = BASE_DIR / "logs"
LOG_DIR.mkdir(parents=True, exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        RotatingFileHandler(LOG_DIR / "halay_studio.log", maxBytes=2_000_000, backupCount=2, encoding="utf-8"),
        logging.StreamHandler(sys.stdout),
    ],
)
logger = logging.getLogger("halay.server")

ALLOWED_AVATAR_SUFFIXES = (
    "tiktokcdn.com",
    "tiktokcdn-us.com",
    "tiktokcdn-eu.com",
    "tiktokcdn-in.com",
    "ibyteimg.com",
    "musical.ly",
    "ibytedtos.com",
    "ytimg.com",
    "ggpht.com",
    "fbsbx.com",
    "fbcdn.net",
    "googleusercontent.com",
)

ws_clients: Set[WebSocket] = set()
avatar_cache: Dict[str, tuple[bytes, str]] = {}
BOOT_TS = time.time()


def is_safe_avatar_url(raw_url: str) -> bool:
    """ECC Security Hardening: Blocks SSRF to loopback/LAN/metadata IPs and restricts to trusted CDN domains."""
    try:
        parsed = urllib.parse.urlparse(raw_url)
        if parsed.scheme not in ("https", "http") or not parsed.hostname:
            return False
        host = parsed.hostname.lower().rstrip(".")
        try:
            ip_obj = ipaddress.ip_address(host)
            if ip_obj.is_private or ip_obj.is_loopback or ip_obj.is_link_local or ip_obj.is_reserved:
                return False
        except ValueError:
            pass
        return any(host == dom or host.endswith("." + dom) for dom in ALLOWED_AVATAR_SUFFIXES)
    except Exception:
        return False


def get_lan_ip() -> str:
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("8.8.8.8", 80))
            return s.getsockname()[0]
    except Exception:
        return "127.0.0.1"


LAN_IP = get_lan_ip()


async def _send_ws_one(ws: WebSocket, msg: str) -> Optional[WebSocket]:
    try:
        await asyncio.wait_for(ws.send_text(msg), timeout=2.5)
        return None
    except Exception:
        return ws


async def broadcast_event(payload: Dict[str, Any]) -> None:
    if not ws_clients:
        return
    msg = json.dumps(payload, ensure_ascii=False)
    targets = list(ws_clients)
    results = await asyncio.gather(*(_send_ws_one(ws, msg) for ws in targets), return_exceptions=True)
    for res in results:
        if isinstance(res, WebSocket):
            ws_clients.discard(res)
            try:
                await res.close()
            except Exception:
                pass
    if payload.get("type") in ("audience_poll", "scheduled_event", "mega_party_burst", "country_takeover", "director_control"):
        asyncio.create_task(ai_host.on_stage_broadcast(payload))


bridge = HalayLiveBridge(broadcast_event)
jukebox = HalayJukeboxService(broadcast_event)
jukebox.shuffle = True
bridge.jukebox_request_fn = jukebox.request_by_query
ai_host = MultilingualAIHost(broadcast_event, bridge.send_chat_message)
ai_host.room_snapshot_fn = lambda: {
    "dancers": len(bridge.joined_uids),
    "leader": str((bridge.halaybasi_user or {}).get("nickname") or "Meydan"),
    "viewer_count": bridge.viewer_count,
    "roles": bridge.get_vip_roles(),
    "lang_scores": dict(bridge.lang_scores),
    **bridge.get_round_state(),
}
bridge.ai_chat_hook = ai_host.on_viewer_chat
bridge.ai_role_hook = ai_host.announce_vip_event

http_session: AsyncSession | None = None
avatar_sem = asyncio.Semaphore(12)
director_state: Dict[str, Any] = {
    "atmosphere": "day",
    "weather": "auto",
    "camera": "auto",
    "hud_lang": "auto",
    "vs_mode": "auto",
    "figure": "auto",
    "floor": "altigen",
    "tempo": "normal",
    "davul": False,
}
VENUE_ROTATION_SEC = 150.0
VENUE_PRESETS = (
    {"atmosphere": "day", "weather": "clear", "floor": "altigen", "figure": "ana"},
    {"atmosphere": "sunset", "weather": "fireflies", "floor": "kum", "figure": "kol"},
    {"atmosphere": "night", "weather": "fireflies", "floor": "seramik", "figure": "one"},
    {"atmosphere": "snow", "weather": "snow", "floor": "seramik", "figure": "cokme"},
    {"atmosphere": "rain", "weather": "rain", "floor": "toprak", "figure": "ana"},
)
_venue_idx: int = 0
_last_venue_rotate_ts: float = time.monotonic()


async def apply_director_preset(patch: Dict[str, Any], extra: Dict[str, Any] | None = None) -> None:
    global _last_venue_rotate_ts
    if isinstance(patch, dict):
        for k, allowed in (
            ("atmosphere", ("day", "sunset", "night", "snow", "rain")),
            ("weather", ("auto", "clear", "snow", "rain", "fireflies", "confetti", "disco")),
            ("camera", ("auto", "wide", "leader", "drone")),
            ("hud_lang", ("auto", "tr", "en", "ru", "ar", "es", "de", "fr", "az")),
            ("vs_mode", ("auto", "world", "city", "wedding")),
            ("figure", ("auto", "ana", "one", "cokme", "kol")),
            ("floor", ("altigen", "seramik", "kum", "toprak")),
            ("tempo", ("normal", "peak")),
        ):
            if patch.get(k) in allowed:
                director_state[k] = str(patch[k])
                if k == "atmosphere":
                    _last_venue_rotate_ts = time.monotonic()
        if "davul" in patch:
            director_state["davul"] = bool(patch["davul"])
    await broadcast_event({"type": "director_control", **director_state, **(extra or {})})


bridge.event_scheduler.apply_director_fn = lambda d: apply_director_preset(d, {"from_poll": True})
TUNNEL_URL_FILE = LOG_DIR / "active_tunnel_url.txt"
TUNNEL_LOG_FILE = LOG_DIR / "cloudflared_9944.log"
PUBLIC_TUNNEL_URL: str = ""
tunnel_proc: subprocess.Popen | None = None


def _read_saved_tunnel_url(allow_fallback_file: bool = True) -> str:
    try:
        if TUNNEL_LOG_FILE.exists():
            txt = TUNNEL_LOG_FILE.read_text(encoding="utf-8", errors="ignore")
            matches = re.findall(r"https://[a-z0-9-]+\.trycloudflare\.com", txt)
            if matches:
                return f"{matches[-1]}/?obs=1"
    except Exception:
        pass
    if allow_fallback_file:
        try:
            if TUNNEL_URL_FILE.exists():
                u = TUNNEL_URL_FILE.read_text(encoding="utf-8", errors="ignore").strip()
                if u.startswith("https://") and ".trycloudflare.com" in u:
                    return u
        except Exception:
            pass
    return ""


def _is_9944_tunnel_alive() -> bool:
    try:
        out = subprocess.check_output(
            ["powershell", "-NoProfile", "-Command",
             "Get-CimInstance Win32_Process -Filter \"Name = 'cloudflared.exe'\" | Select-Object -ExpandProperty CommandLine"],
            text=True,
            encoding="utf-8",
            errors="ignore",
            timeout=4,
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
        )
        return "127.0.0.1:9944" in out
    except Exception:
        return False


def _start_cloudflared_tunnel(loop: asyncio.AbstractEventLoop, port: int = 9944) -> None:
    global tunnel_proc, PUBLIC_TUNNEL_URL
    cf_bin = shutil.which("cloudflared") or r"C:\Program Files (x86)\cloudflared\cloudflared.exe"
    if not os.path.exists(cf_bin):
        logger.warning("cloudflared binary not found; public 5G tunnel disabled.")
        return

    # Reuse existing detached 9944 tunnel if already running so link NEVER changes on server restart
    existing_url = _read_saved_tunnel_url()
    if existing_url and _is_9944_tunnel_alive():
        PUBLIC_TUNNEL_URL = existing_url
        print(f"[+] Sabit Mobil 4.5G/5G Tuneli (Korundu): {PUBLIC_TUNNEL_URL}", flush=True)
        return

    try:
        log_fp = open(TUNNEL_LOG_FILE, "w", encoding="utf-8", errors="replace")
        creation_flags = (
            getattr(subprocess, "CREATE_NO_WINDOW", 0)
            | getattr(subprocess, "DETACHED_PROCESS", 0)
            | getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0)
        )
        tunnel_proc = subprocess.Popen(
            [
                cf_bin,
                "tunnel",
                "--url",
                f"http://127.0.0.1:{port}",
                "--no-autoupdate",
                "--protocol",
                "http2",
                "--ha-connections",
                "4",
            ],
            stdout=log_fp,
            stderr=subprocess.STDOUT,
            stdin=subprocess.DEVNULL,
            creationflags=creation_flags,
            close_fds=True,
        )
    except Exception as exc:
        logger.warning("Failed to start cloudflared tunnel: %s", exc)
        return

    def _watcher() -> None:
        global PUBLIC_TUNNEL_URL
        deadline = time.time() + 25.0
        while time.time() < deadline:
            url = _read_saved_tunnel_url(allow_fallback_file=False)
            if url:
                PUBLIC_TUNNEL_URL = url
                try:
                    TUNNEL_URL_FILE.write_text(PUBLIC_TUNNEL_URL, encoding="utf-8")
                except Exception:
                    pass
                print(f"[+] Mobil 4.5G/5G Internet Tuneli  : {PUBLIC_TUNNEL_URL}", flush=True)
                asyncio.run_coroutine_threadsafe(
                    broadcast_event({"type": "lan_info", "lan_ip": LAN_IP, "public_url": PUBLIC_TUNNEL_URL}),
                    loop,
                )
                return
            time.sleep(0.4)

    threading.Thread(target=_watcher, daemon=True).start()


def _loop_exception_handler(loop: asyncio.AbstractEventLoop, context: Dict[str, Any]) -> None:
    exc = context.get("exception")
    msg = str(context.get("message", ""))
    if exc and exc.__class__.__name__ in (
        "ConnectionClosedError",
        "ConnectionResetError",
        "BrokenPipeError",
        "IncompleteReadError",
        "CancelledError",
    ):
        return
    if "_call_connection_lost" in msg and isinstance(exc, OSError):
        return
    loop.default_exception_handler(context)


async def _venue_rotation_loop() -> None:
    global _venue_idx, _last_venue_rotate_ts
    while True:
        await asyncio.sleep(5.0)
        try:
            cur_tr = jukebox.track_map.get(jukebox.current_id) if jukebox.current_id else None
            started_ts = float(getattr(jukebox, "current_started_ts", 0.0) or 0.0)
            if (
                cur_tr
                and started_ts > 0.0
                and not jukebox.current_requested_by
                and int(cur_tr.get("duration") or 0) > 240
                and (time.time() - started_ts) >= 210.0
            ):
                logger.info("Uzun parca (%ss) 210sn sinirina ulasti; sonraki parcaya geciliyor.", cur_tr.get("duration"))
                await jukebox.advance_next(prev_direction=False)
        except Exception as exc:
            logger.debug("Jukebox duration guard skip: %s", exc)
        now_m = time.monotonic()
        if bridge.event_scheduler.active_poll is not None or bridge.event_scheduler.active_event is not None:
            continue
        if (now_m - _last_venue_rotate_ts) < VENUE_ROTATION_SEC:
            continue
        _last_venue_rotate_ts = now_m
        _venue_idx = (_venue_idx + 1) % len(VENUE_PRESETS)
        preset = VENUE_PRESETS[_venue_idx]
        director_state.update(preset)
        logger.info("5 dakikalik mekan degisimi: %s", preset["atmosphere"])
        await broadcast_event({"type": "director_control", **director_state, "auto_rotated": True})


@asynccontextmanager
async def lifespan(_: FastAPI):
    global http_session
    loop = asyncio.get_running_loop()
    loop.set_exception_handler(_loop_exception_handler)
    http_session = AsyncSession(impersonate="chrome124", timeout=3.0)
    _start_cloudflared_tunnel(loop, int(os.environ.get("HALAY_PORT", "9944")))
    jukebox.schedule_lookahead_prefetch()
    await ai_host.start()
    await bridge.boot()
    venue_task = asyncio.create_task(_venue_rotation_loop())
    try:
        yield
    finally:
        venue_task.cancel()
        try:
            await venue_task
        except asyncio.CancelledError:
            pass
        # Never terminate cloudflared on server reload so user's mobile URL never drops!
        await ai_host.stop()
        await bridge.shutdown()
        if http_session is not None:
            await http_session.close()
            http_session = None


app = FastAPI(title="TikTok LIVE Kır Düğünü & 100 Halay Pro Studio", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


TUNNEL_CHARACTER_SUBSET = {
    "cocuk-1-erkek",
    "damat",
    "erkek-01",
    "erkek-1-rocker",
    "erkek-3-beyefendi",
    "gelin",
    "hamambocegi",
    "kiz-2-disko",
    "kiz-4-balerin",
    "zurnaci",
}


@app.middleware("http")
async def tiktok_live_studio_cors_headers(request: Request, call_next):
    if request.method == "OPTIONS":
        return Response(
            status_code=200,
            headers={
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, POST, HEAD, OPTIONS",
                "Access-Control-Allow-Headers": "*",
                "Access-Control-Allow-Private-Network": "true",
            },
        )
    response = await call_next(request)
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Private-Network"] = "true"
    path = request.url.path
    if (
        path.startswith("/static/js")
        or path.startswith("/static/css")
        or path in ("/", "/local_sdk.js", "/assets/models/characters/manifest.json")
    ):
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate, max-age=0"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
    elif path.startswith("/bundle/") or path.startswith("/assets/"):
        response.headers.setdefault("Cache-Control", "public, max-age=604800, immutable")
    return response


@app.get("/favicon.ico")
async def favicon_no_content() -> Response:
    return Response(status_code=204, headers={"Cache-Control": "public, max-age=86400"})


@app.get("/assets/models/characters/manifest.json")
async def serve_character_manifest(request: Request) -> JSONResponse:
    manifest_path = DIVALAR_DIR / "assets" / "models" / "characters" / "manifest.json"
    if not manifest_path.exists():
        return JSONResponse({"modeller": []}, headers={"Cache-Control": "no-cache", "Vary": "CF-Ray"})
    try:
        items = json.loads(manifest_path.read_text(encoding="utf-8"))
    except Exception:
        items = {"modeller": []}
    is_tunnel = bool(request.headers.get("cf-ray") or request.headers.get("cf-connecting-ip"))
    if is_tunnel and request.query_params.get("full") != "1":
        if isinstance(items, dict) and isinstance(items.get("modeller"), list):
            slim = [m for m in items["modeller"] if isinstance(m, dict) and m.get("id") in TUNNEL_CHARACTER_SUBSET]
            if len(slim) >= 6:
                items = {**items, "modeller": slim}
        elif isinstance(items, list):
            slim = [m for m in items if isinstance(m, dict) and m.get("id") in TUNNEL_CHARACTER_SUBSET]
            if len(slim) >= 6:
                items = slim
    return JSONResponse(items, headers={"Cache-Control": "no-cache", "Vary": "CF-Ray"})


app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")
if (DIVALAR_DIR / "bundle").exists():
    app.mount("/bundle", StaticFiles(directory=str(DIVALAR_DIR / "bundle")), name="divalar_bundle")
if (DIVALAR_DIR / "assets").exists():
    app.mount("/assets", StaticFiles(directory=str(DIVALAR_DIR / "assets")), name="divalar_assets")


@app.api_route("/", methods=["GET", "HEAD", "OPTIONS"])
async def index_page() -> FileResponse:
    divalar_html = DIVALAR_DIR / "index_local.html"
    target = divalar_html if divalar_html.exists() else (STATIC_DIR / "index.html")
    return FileResponse(
        str(target),
        headers={
            "Cache-Control": "no-cache",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Private-Network": "true",
        },
    )


@app.get("/legacy")
async def legacy_index_page() -> FileResponse:
    return FileResponse(str(STATIC_DIR / "index.html"), headers={"Cache-Control": "no-cache"})


@app.get("/oyunlar")
async def games_hub_page() -> FileResponse:
    return FileResponse(str(STATIC_DIR / "oyunlar.html"), headers={"Cache-Control": "no-cache"})


@app.get("/araba")
async def car_race_page() -> FileResponse:
    return FileResponse(str(STATIC_DIR / "araba.html"), headers={"Cache-Control": "no-cache"})


@app.get("/slime")
async def slime_arena_page() -> FileResponse:
    return FileResponse(str(STATIC_DIR / "slime.html"), headers={"Cache-Control": "no-cache"})


@app.get("/futbol")
async def football_page() -> FileResponse:
    return FileResponse(str(STATIC_DIR / "futbol.html"), headers={"Cache-Control": "no-cache"})


@app.get("/local_sdk.js")
async def serve_local_sdk() -> FileResponse:
    return FileResponse(
        str(DIVALAR_DIR / "local_sdk.js"),
        media_type="application/javascript",
        headers={"Cache-Control": "no-cache", "Access-Control-Allow-Origin": "*"},
    )


@app.get("/api/divalar_settings")
async def get_divalar_settings() -> JSONResponse:
    if DIVALAR_SETTINGS_FILE.exists():
        try:
            raw = json.loads(DIVALAR_SETTINGS_FILE.read_text(encoding="utf-8"))
            return JSONResponse({"ok": True, "exists": True, "jsonData": raw})
        except Exception:
            pass
    return JSONResponse({"ok": True, "exists": False, "jsonData": None})


def _is_local_admin_http(request: Request) -> bool:
    admin_tok = os.environ.get("HALAY_ADMIN_TOKEN", "").strip()
    if admin_tok:
        hdr_tok = (request.headers.get("x-admin-token") or request.query_params.get("token") or "").strip()
        if hdr_tok == admin_tok:
            return True
        if request.headers.get("cf-connecting-ip") or request.headers.get("cf-ray"):
            return False
    if request.headers.get("cf-connecting-ip") or request.headers.get("cf-ray"):
        return False
    host = (request.client.host if request.client else "") or ""
    if host in ("127.0.0.1", "::1", "localhost"):
        return True
    try:
        ip_obj = ipaddress.ip_address(host)
        return bool(ip_obj.is_loopback or ip_obj.is_private)
    except ValueError:
        return False


@app.post("/api/divalar_settings")
async def save_divalar_settings(request: Request) -> JSONResponse:
    if not _is_local_admin_http(request):
        return JSONResponse({"ok": False, "error": "Local admin only"}, status_code=403)
    try:
        body = await request.json()
        data = body.get("jsonData") if isinstance(body, dict) else None
        if isinstance(data, dict):
            DIVALAR_SETTINGS_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    except Exception as exc:
        logger.warning("Failed saving divalar settings: %s", exc)
    return JSONResponse({"ok": True})


@app.get("/api/health")
async def health_check() -> JSONResponse:
    jb = jukebox.get_public_state()
    return JSONResponse({
        "ok": True,
        "uptime_sec": round(time.time() - BOOT_TS, 1),
        "ws_clients": len(ws_clients),
        "jukebox_tracks": jb["total_tracks"],
        "jukebox_cached": jb["cached_count"],
        "ssrf_guard": "strict_allowlist_enabled",
    })


@app.get("/api/status")
async def get_status() -> JSONResponse:
    return JSONResponse({
        "ok": True,
        "port": 9944,
        "demo_enabled": False,
        "lan_ip": LAN_IP,
        "obs_url": "http://127.0.0.1:9944/?obs=1",
        "mobile_lan_url": f"http://{LAN_IP}:9944/?obs=1",
        "public_tunnel_url": PUBLIC_TUNNEL_URL,
        "connected": bridge.is_live_connected,
        "watching": bridge.is_watching,
        "username": bridge.target_username,
        "room_id": bridge.connected_room_id,
        "viewer_count": bridge.viewer_count,
        "total_likes": bridge.total_likes,
        "total_comments": bridge.total_comments,
        "total_gifts": bridge.total_gifts,
        "like_threshold": bridge.like_threshold,
        "tier2_min": bridge.tier2_min,
        "tier3_min": bridge.tier3_min,
        "scene_mode": bridge.scene_mode,
        "avatar_style": bridge.avatar_style,
        "joined_count": len(bridge.joined_uids),
        "combo_count": bridge.combo_count,
        "halaybasi": bridge.halaybasi_user,
        "gelin": bridge.gelin_user,
        "damat": bridge.damat_user,
        "roles": bridge.get_vip_roles(),
        "leaderboard": bridge.get_leaderboard(),
        "team_scores": bridge.team_scores,
        "city_leaderboard": bridge.get_city_leaderboard(),
        "country_scores": bridge.country_scores,
        "lang_scores": bridge.lang_scores,
        "director": director_state,
        "jukebox": jukebox.get_public_state(),
        **bridge.get_round_state(),
        "note": bridge.status_note,
    })


@app.get("/api/jukebox/catalog")
async def get_jukebox_catalog() -> JSONResponse:
    return JSONResponse(jukebox.get_catalog_payload())


@app.get("/ai-panel")
async def serve_ai_panel(request: Request) -> Response:
    if not _is_local_admin_http(request):
        return JSONResponse({"ok": False, "error": "Admin panel is restricted to local network"}, status_code=403)
    return FileResponse(str(STATIC_DIR / "ai_panel.html"), headers={"Cache-Control": "no-cache"})


@app.get("/api/system/metrics")
async def get_system_metrics() -> JSONResponse:
    proc_info: Dict[str, Any] = {"rss_mb": 0.0, "cpu_pct": 0.0}
    try:
        import psutil  # type: ignore
        proc = psutil.Process(os.getpid())
        proc_info = {
            "rss_mb": round(proc.memory_info().rss / (1024 * 1024), 1),
            "cpu_pct": round(proc.cpu_percent(interval=0.0), 1),
        }
    except Exception:
        pass
    return JSONResponse({
        "ok": True,
        "uptime_sec": round(time.time() - BOOT_TS, 1),
        "ws_clients": len(ws_clients),
        "process": proc_info,
        "event_engine": bridge.event_engine.metrics(),
        "scheduler": bridge.event_scheduler.snapshot(),
        "seats": {
            "active": len(bridge.joined_users),
            "max": bridge.max_halay_seats,
            "queue": len(bridge.waiting_queue),
        },
        "dancers": [
            {
                "uid": str(d.get("uid", "")),
                "nickname": d.get("nickname", "Misafir"),
                "outfit": d.get("outfit", ""),
                "team": bridge.user_teams.get(str(d.get("uid", "")), d.get("team", "")),
                "diamonds": bridge.user_round_diamonds.get(str(d.get("uid", "")), 0),
                "vip": str(d.get("uid", "")) in bridge.dancer_vip,
            }
            for d in bridge.joined_users
        ],
        "waiting_queue": [
            {"uid": str(q.get("uid", "")), "nickname": q.get("nickname", "Misafir")}
            for q in bridge.waiting_queue[:30]
        ],
        "vip_roles": bridge.get_vip_roles(),
        "round": bridge.get_round_state(),
        "viewer_total": bridge.viewer_store.total_viewers(),
    })


@app.get("/api/gifts/rules")
async def get_gift_rules() -> JSONResponse:
    try:
        data = json.loads(DIVALAR_SETTINGS_FILE.read_text(encoding="utf-8")) if DIVALAR_SETTINGS_FILE.exists() else {}
    except Exception:
        data = {}
    return JSONResponse({"ok": True, "settings": data, "like_threshold": bridge.like_threshold})


@app.post("/api/gifts/rules")
async def update_gift_rules(request: Request) -> JSONResponse:
    if not _is_local_admin_http(request):
        return JSONResponse({"ok": False, "error": "Local admin only"}, status_code=403)
    try:
        body = await request.json()
    except Exception:
        return JSONResponse({"ok": False, "error": "Invalid JSON"}, status_code=400)
    if not isinstance(body, dict):
        return JSONResponse({"ok": False, "error": "Expected JSON object"}, status_code=400)
    try:
        current = json.loads(DIVALAR_SETTINGS_FILE.read_text(encoding="utf-8")) if DIVALAR_SETTINGS_FILE.exists() else {}
    except Exception:
        current = {}
    if isinstance(body.get("settings"), dict):
        current = body["settings"]
    else:
        if "rules" in body and isinstance(body["rules"], list):
            current["rules"] = body["rules"]
        if "maxDancers" in body:
            current["maxDancers"] = max(6, min(100, int(body["maxDancers"])))
    DIVALAR_SETTINGS_FILE.write_text(json.dumps(current, ensure_ascii=False, indent=2), encoding="utf-8")
    if "like_threshold" in body:
        bridge.like_threshold = max(1, int(body["like_threshold"]))
        bridge.save_config()
    return JSONResponse({"ok": True, "settings": current, "like_threshold": bridge.like_threshold})


@app.post("/api/dancers/action")
async def dancer_admin_action(request: Request) -> JSONResponse:
    if not _is_local_admin_http(request):
        return JSONResponse({"ok": False, "error": "Local admin only"}, status_code=403)
    try:
        body = await request.json()
    except Exception:
        return JSONResponse({"ok": False, "error": "Invalid JSON"}, status_code=400)
    if not isinstance(body, dict):
        return JSONResponse({"ok": False, "error": "Expected JSON object"}, status_code=400)
    action = str(body.get("action", "")).strip()
    uid = str(body.get("uid", "")).strip()
    if action == "kick":
        ok = await bridge.kick_dancer(uid)
        return JSONResponse({"ok": ok, "action": "kick", "uid": uid})
    if action == "promote_halaybasi":
        ok = await bridge.promote_halaybasi(uid)
        return JSONResponse({"ok": ok, "action": "promote_halaybasi", "uid": uid})
    return JSONResponse({"ok": False, "error": "Unknown action"}, status_code=400)


@app.post("/api/events/trigger")
async def trigger_scheduled_event(request: Request) -> JSONResponse:
    if not _is_local_admin_http(request):
        return JSONResponse({"ok": False, "error": "Local admin only"}, status_code=403)
    try:
        body = await request.json()
    except Exception:
        return JSONResponse({"ok": False, "error": "Invalid JSON"}, status_code=400)
    if not isinstance(body, dict):
        return JSONResponse({"ok": False, "error": "Expected JSON object"}, status_code=400)
    action = str(body.get("action", "start")).strip()
    if action == "stop":
        res = await bridge.event_scheduler.stop_event()
        return JSONResponse(res)
    if action == "stop_poll":
        res = await bridge.event_scheduler.stop_poll()
        return JSONResponse(res)
    if action == "surprise":
        res = await bridge.event_scheduler.start_surprise_event(source="manual")
        return JSONResponse(res)
    if action == "poll":
        try:
            dur = int(body.get("duration_sec", 45) or 45)
        except (TypeError, ValueError):
            dur = 45
        res = await bridge.event_scheduler.start_poll(duration_sec=dur)
        return JSONResponse(res)
    ev_id = str(body.get("event_id", "disco_mode")).strip()
    try:
        dur_override = int(body["duration_sec"]) if body.get("duration_sec") else None
    except (TypeError, ValueError):
        dur_override = None
    res = await bridge.event_scheduler.start_event(ev_id, source="manual", duration_override=dur_override)
    return JSONResponse(res)


@app.get("/api/viewers/top")
async def get_top_viewers() -> JSONResponse:
    return JSONResponse({
        "ok": True,
        "top_xp": bridge.viewer_store.get_top_xp(15),
        "team_history": bridge.viewer_store.get_team_history(10),
        "total_viewers": bridge.viewer_store.total_viewers(),
    })


@app.get("/api/tts/{clip_id}.mp3")
async def serve_ai_tts_clip(clip_id: str) -> Response:
    audio = ai_host.get_tts_audio(clip_id)
    if not audio:
        return Response(status_code=404)
    return Response(
        content=audio,
        media_type="audio/mpeg",
        headers={"Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=3600"},
    )


@app.get("/api/ai/state")
async def get_ai_host_state() -> JSONResponse:
    return JSONResponse({
        "ok": True,
        "has_session_id": bool(bridge.tiktok_session_id),
        "open_multilang_dj": bridge.open_multilang_dj,
        "last_bot_chat": bridge.last_bot_chat_status,
        "is_live_connected": bridge.is_live_connected,
        **ai_host.get_state(),
    })


@app.post("/api/ai/options")
async def set_ai_host_options(request: Request) -> JSONResponse:
    if not _is_local_admin_http(request):
        return JSONResponse({"ok": False, "error": "Local admin only"}, status_code=403)
    body = await request.json()
    if isinstance(body, dict) and "session_id" in body:
        await bridge.set_session_id(str(body["session_id"]))
    if isinstance(body, dict) and "open_multilang_dj" in body:
        bridge.open_multilang_dj = bool(body["open_multilang_dj"])
    st = ai_host.update_options(body if isinstance(body, dict) else {})
    return JSONResponse({
        "ok": True,
        "has_session_id": bool(bridge.tiktok_session_id),
        "open_multilang_dj": bridge.open_multilang_dj,
        "last_bot_chat": bridge.last_bot_chat_status,
        "is_live_connected": bridge.is_live_connected,
        **st,
    })


@app.post("/api/ai/announce")
async def trigger_ai_announcement(request: Request) -> JSONResponse:
    if not _is_local_admin_http(request):
        return JSONResponse({"ok": False, "error": "Local admin only"}, status_code=403)
    ev = await ai_host.trigger_periodic_now()
    return JSONResponse({"ok": True, "event": ev})


@app.post("/api/ai/send_chat")
async def send_manual_stream_chat(request: Request) -> JSONResponse:
    if not _is_local_admin_http(request):
        return JSONResponse({"ok": False, "error": "Local admin only"}, status_code=403)
    body = await request.json()
    text = str((body or {}).get("text") or "").strip()
    lang = str((body or {}).get("lang") or "tr").strip().lower()
    speak = bool((body or {}).get("speak", True))
    res = await ai_host.send_manual_chat(text, lang=lang, speak=speak)
    return JSONResponse({
        **res,
        "has_session_id": bool(bridge.tiktok_session_id),
        "is_live_connected": bridge.is_live_connected,
        "last_bot_chat": bridge.last_bot_chat_status,
    })


@app.post("/api/jukebox/request_multilang")
async def request_multilang_song(request: Request) -> JSONResponse:
    if not _is_local_admin_http(request):
        return JSONResponse({"ok": False, "error": "Local admin only"}, status_code=403)
    body = await request.json()
    query = str((body or {}).get("query") or "").strip()[:60]
    nickname = str((body or {}).get("nickname") or "MeydanDJ")[:24]
    lang = str((body or {}).get("lang") or "ru").strip().lower()
    flag = str((body or {}).get("flag") or "🌍")[:8]
    matched = await jukebox.request_by_query(query, nickname, True, lang=lang, flag=flag)
    if matched:
        tr_title = (matched.get("current") or {}).get("title") or matched.get("title") or query or "DJ Mix"
        await ai_host.announce_vip_event({"uid": "panel_dj", "nickname": nickname, "avatar": ""}, "dj_play", str(tr_title)[:50], 0, lang)
    return JSONResponse({"ok": bool(matched), "state": jukebox.get_public_state()})


@app.post("/api/fx/test")
async def trigger_stage_fx_test(request: Request) -> JSONResponse:
    if not _is_local_admin_http(request):
        return JSONResponse({"ok": False, "error": "Local admin only"}, status_code=403)
    body = await request.json()
    fx = str((body or {}).get("fx") or "disco").strip().lower()
    nick = str((body or {}).get("nickname") or "MeydanŞampiyonu")[:24]
    uid = str((body or {}).get("uid") or "")
    if not uid and bridge.joined_users:
        uid = str(bridge.joined_users[0].get("uid") or "test_fx")
    await broadcast_event({
        "type": "stage_fx",
        "fx": fx,
        "uid": uid or "test_fx",
        "nickname": nick,
        "city": str((body or {}).get("city") or "34 İstanbul"),
    })
    return JSONResponse({"ok": True, "fx": fx, "uid": uid, "nickname": nick})


@app.post("/api/economy/test")
async def trigger_economy_test(request: Request) -> JSONResponse:
    if not _is_local_admin_http(request):
        return JSONResponse({"ok": False, "error": "Local admin only"}, status_code=403)
    body = await request.json()
    if not isinstance(body, dict):
        return JSONResponse({"ok": False, "error": "Invalid payload"}, status_code=400)
    action = str(body.get("action") or "").strip().lower()
    uid = str(body.get("uid") or f"test_{int(time.time())}")
    nick = str(body.get("nickname") or "TestKonuk")[:24]
    u = {"uid": uid, "nickname": nick, "avatar": str(body.get("avatar") or "")}
    if action == "chat":
        await bridge.process_chat(u, str(body.get("text") or "KATIL"))
    elif action == "gift":
        g_name = str(body.get("gift_name") or "Donut")
        diamonds = max(1, int(body.get("diamonds") or 30))
        gift_id = int(body.get("gift_id") or (5879 if diamonds == 30 else 0))
        d_unit = int(body.get("diamond_unit") or diamonds)
        await bridge.process_gift(u, g_name, diamonds, gift_id=gift_id, diamond_unit=d_unit, repeat_count=1)
    elif action == "next_round":
        await bridge.simulate_studio_action("next_round")
    else:
        return JSONResponse({"ok": False, "error": "Unknown economy test action"}, status_code=400)
    return JSONResponse({
        "ok": True,
        "action": action,
        "joined_count": len(bridge.joined_uids),
        "halaybasi": bridge.halaybasi_user,
        "gelin": bridge.gelin_user,
        "damat": bridge.damat_user,
        **bridge.get_round_state(),
    })


@app.get("/api/director/state")
async def get_director_state() -> JSONResponse:
    return JSONResponse({"ok": True, **director_state})


@app.post("/api/director/control")
async def update_director_control(request: Request) -> JSONResponse:
    if not _is_local_admin_http(request):
        return JSONResponse({"ok": False, "error": "Local admin only"}, status_code=403)
    body = await request.json()
    extra: Dict[str, Any] = {}
    if isinstance(body, dict):
        if body.get("atmosphere") in ("day", "sunset", "night", "snow", "rain"):
            global _last_venue_rotate_ts
            director_state["atmosphere"] = str(body["atmosphere"])
            _last_venue_rotate_ts = time.monotonic()
        if body.get("weather") in ("auto", "clear", "snow", "rain", "fireflies", "confetti", "disco"):
            director_state["weather"] = str(body["weather"])
        if body.get("camera") in ("auto", "wide", "leader", "drone"):
            director_state["camera"] = str(body["camera"])
        if body.get("hud_lang") in ("auto", "tr", "en", "ru", "ar", "es", "de", "fr", "az"):
            director_state["hud_lang"] = str(body["hud_lang"])
        if body.get("vs_mode") in ("auto", "world", "city", "wedding"):
            director_state["vs_mode"] = str(body["vs_mode"])
        if body.get("figure") in ("auto", "ana", "one", "cokme", "kol"):
            director_state["figure"] = str(body["figure"])
        if body.get("floor") in ("altigen", "seramik", "kum", "toprak"):
            director_state["floor"] = str(body["floor"])
        if body.get("tempo") in ("normal", "peak"):
            director_state["tempo"] = str(body["tempo"])
        if "davul" in body:
            director_state["davul"] = bool(body["davul"])
        if body.get("director_seq") in ("spotlight", "celebrate", "para", "drop", "couple_cheer", "fireworks"):
            extra["director_seq"] = str(body["director_seq"])
    await broadcast_event({"type": "director_control", **director_state, **extra})
    return JSONResponse({"ok": True, **director_state})


tikoyun_settings_state: Dict[str, Any] = {
    "maxDancers": 200,
    "paraSeconds": 5,
    "camera": "sinematik",
    "format": "dikey",
    "genderSwap": True,
}


@app.get("/api/tikoyun/settings")
async def get_tikoyun_settings(request: Request) -> JSONResponse:
    if not _is_local_admin_http(request):
        return JSONResponse({"ok": False, "error": "Local admin only"}, status_code=403)
    return JSONResponse({"ok": True, **tikoyun_settings_state})


@app.post("/api/tikoyun/settings")
async def update_tikoyun_settings(request: Request) -> JSONResponse:
    if not _is_local_admin_http(request):
        return JSONResponse({"ok": False, "error": "Local admin only"}, status_code=403)
    body = await request.json()
    payload: Dict[str, Any] = {"type": "tikoyun_settings"}
    if isinstance(body, dict):
        action = str(body.get("action", "") or "")
        if action in ("halayreset", "reset_defaults"):
            payload["action"] = action
            if action == "reset_defaults":
                tikoyun_settings_state.update({
                    "maxDancers": 200,
                    "paraSeconds": 5,
                    "camera": "sinematik",
                    "format": "dikey",
                    "genderSwap": True,
                })
                payload.update(tikoyun_settings_state)
        else:
            if "maxDancers" in body:
                v = max(20, min(200, round(int(body["maxDancers"]) / 10) * 10))
                tikoyun_settings_state["maxDancers"] = v
            if "paraSeconds" in body:
                v = max(2, min(30, int(body["paraSeconds"])))
                tikoyun_settings_state["paraSeconds"] = v
            if body.get("camera") in ("sinematik", "serbest"):
                tikoyun_settings_state["camera"] = str(body["camera"])
            if body.get("format") in ("dikey", "yatay"):
                tikoyun_settings_state["format"] = str(body["format"])
            if "genderSwap" in body:
                tikoyun_settings_state["genderSwap"] = bool(body["genderSwap"])
            payload.update(tikoyun_settings_state)
    await broadcast_event(payload)
    return JSONResponse({"ok": True, **tikoyun_settings_state})


@app.post("/api/world/fx")
async def trigger_world_fx_api(request: Request) -> JSONResponse:
    if not _is_local_admin_http(request):
        return JSONResponse({"ok": False, "error": "Local admin only"}, status_code=403)
    body = await request.json()
    fx = str(body.get("fx", "") if isinstance(body, dict) else "").strip().lower()
    if fx in ("fireflies", "birds", "kids", "wanderers", "banquet", "para_throw"):
        await broadcast_event({"type": "world_fx", "fx": fx})
        return JSONResponse({"ok": True, "fx": fx})
    return JSONResponse({"ok": False, "error": "Unknown world fx"}, status_code=400)


@app.post("/api/ai/test")
async def trigger_ai_multilang_test(request: Request) -> JSONResponse:
    if not _is_local_admin_http(request):
        return JSONResponse({"ok": False, "error": "Local admin only"}, status_code=403)
    body = await request.json()
    nick = str(body.get("nickname") or "Sofia_RU")[:20]
    text = str(body.get("text") or "Привет! А как зайти в танец?")[:80]
    ev = await ai_host.on_viewer_chat(
        {"uid": f"test_{int(time.time())}", "nickname": nick, "avatar": ""},
        text,
        joined=False,
        rem_likes=bridge.like_threshold,
        dancers=len(bridge.joined_uids),
        leader=str((bridge.halaybasi_user or {}).get("nickname") or "Meydan"),
        force=True,
    )
    return JSONResponse({"ok": True, "event": ev})


@app.get("/api/jukebox/stream/{video_id}")
async def stream_halay_track(video_id: str) -> Response:
    audio_path = await jukebox.ensure_track_cached(video_id)
    if not audio_path or not audio_path.exists():
        logger.warning("Audio track unavailable for %s", video_id)
        return JSONResponse({"ok": False, "error": "Parça hazırlanamadı"}, status_code=404)
    ext = audio_path.suffix.lower()
    mime = "audio/mp4" if ext in (".m4a", ".mp4") else ("audio/mpeg" if ext == ".mp3" else "audio/webm")
    return FileResponse(
        str(audio_path),
        media_type=mime,
        headers={
            "Accept-Ranges": "bytes",
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "public, max-age=86400",
        },
    )


@app.get("/api/avatar")
async def proxy_avatar(url: str = Query(..., min_length=8)) -> Response:
    decoded = urllib.parse.unquote(url) if url.lower().startswith(("http%3a", "https%3a")) else url
    if not is_safe_avatar_url(decoded):
        logger.warning("Blocked disallowed avatar URL: %s", decoded[:90])
        return Response(status_code=403)
    if decoded in avatar_cache:
        data, ctype = avatar_cache[decoded]
        return Response(
            content=data,
            media_type=ctype,
            headers={"Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=3600"},
        )

    ephemeral_sess = None
    try:
        async with avatar_sem:
            sess = http_session
            if sess is None:
                ephemeral_sess = AsyncSession(impersonate="chrome124", timeout=3.0)
                sess = ephemeral_sess
            resp = await sess.get(
                decoded,
                allow_redirects=False,
                headers={"Referer": "https://www.tiktok.com/", "Accept": "image/avif,image/webp,image/*,*/*;q=0.8"},
            )
            if resp.status_code == 200 and resp.content and len(resp.content) <= 2_500_000:
                ctype = resp.headers.get("content-type", "image/jpeg")
                if len(avatar_cache) > 600:
                    avatar_cache.pop(next(iter(avatar_cache)))
                avatar_cache[decoded] = (resp.content, ctype)
                return Response(
                    content=resp.content,
                    media_type=ctype,
                    headers={"Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=3600"},
                )
    except Exception as exc:
        logger.debug("Avatar proxy fetch failed for %s: %s", decoded[:70], exc)
    finally:
        if ephemeral_sess is not None:
            try:
                await ephemeral_sess.close()
            except Exception:
                pass
    return Response(status_code=404, headers={"Access-Control-Allow-Origin": "*"})


def _is_local_admin_ws(ws: WebSocket) -> bool:
    admin_tok = os.environ.get("HALAY_ADMIN_TOKEN", "").strip()
    if admin_tok:
        q_tok = (ws.headers.get("x-admin-token") or ws.query_params.get("token") or "").strip()
        if q_tok == admin_tok:
            return True
    if ws.headers.get("cf-connecting-ip") or ws.headers.get("cf-ray"):
        return False
    host = (ws.client.host if ws.client else "") or ""
    if host in ("127.0.0.1", "::1", "localhost"):
        return True
    try:
        ip_obj = ipaddress.ip_address(host)
        if getattr(ip_obj, "ipv4_mapped", None) is not None:
            ip_obj = ip_obj.ipv4_mapped
        return bool(ip_obj.is_loopback or ip_obj.is_private)
    except ValueError:
        return False


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket) -> None:
    await ws.accept()
    ws_clients.add(ws)
    is_admin = _is_local_admin_ws(ws)
    try:
        await ws.send_text(json.dumps({"type": "lan_info", "lan_ip": LAN_IP, "public_url": PUBLIC_TUNNEL_URL}, ensure_ascii=False))
        await ws.send_text(json.dumps({"type": "jukebox_state", **jukebox.get_public_state()}, ensure_ascii=False))
        await ws.send_text(json.dumps({"type": "director_control", **director_state}, ensure_ascii=False))
        vip_roles = bridge.get_vip_roles()
        if bridge.joined_users or any(vip_roles.values()):
            await ws.send_text(
                json.dumps(
                    {
                        "type": "seed_halay",
                        "users": bridge.joined_users,
                        "user_likes": bridge.user_likes,
                        "roles": vip_roles,
                        "gift_leaderboard": bridge.get_gift_leaderboard(),
                        "top_rewards": bridge.get_top_rewards(),
                        **bridge.get_round_state(),
                    },
                    ensure_ascii=False,
                )
            )
        await bridge._emit_status()

        admin_only_actions = {
            "connect_tiktok",
            "disconnect_tiktok",
            "discover_live",
            "connect_tikfinity",
            "update_rules",
            "studio_control",
            "simulate_event",
            "broadcast_event",
            "reset_halay",
            "reload_overlays",
        }

        while True:
            raw = await ws.receive_text()
            try:
                cmd = json.loads(raw)
            except json.JSONDecodeError:
                logger.warning("Ignored malformed WS JSON payload")
                continue
            if not isinstance(cmd, dict):
                continue

            action = str(cmd.get("action", ""))
            if action in admin_only_actions and not is_admin:
                logger.warning("Blocked unauthorized remote WS admin action: %s", action)
                continue
            if action == "ping":
                await ws.send_text(json.dumps({"type": "pong", "ts": time.time()}))
            elif action == "connect_tiktok":
                res = await bridge.connect_tiktok(str(cmd.get("username", "")), str(cmd.get("session_id", "")))
                await ws.send_text(json.dumps({"type": "cmd_result", **res}, ensure_ascii=False))
            elif action == "disconnect_tiktok":
                await bridge.disconnect_tiktok(clear_target=True)
            elif action == "discover_live":
                asyncio.create_task(bridge.auto_discover_and_connect())
            elif action == "connect_tikfinity":
                await bridge.connect_tikfinity(str(cmd.get("ws_url", "ws://localhost:21213/")))
            elif action == "update_rules":
                await bridge.update_rules(cmd)
            elif action == "studio_control":
                await bridge.trigger_studio_control(str(cmd.get("cmd", "")), cmd.get("value"))
            elif action == "jukebox_select":
                await jukebox.select_track(str(cmd.get("id", "")), requested_by=str(cmd.get("by", "")))
            elif action == "jukebox_next":
                await jukebox.advance_next(prev_direction=False)
            elif action == "jukebox_prev":
                await jukebox.advance_next(prev_direction=True)
            elif action == "jukebox_options":
                await jukebox.set_options(
                    category=cmd.get("category") if "category" in cmd else None,
                    shuffle=cmd.get("shuffle") if "shuffle" in cmd else None,
                )
            elif action == "jukebox_request":
                await jukebox.request_by_query(
                    str(cmd.get("query", "")),
                    str(cmd.get("nickname", "Yayıncı")),
                    bool(cmd.get("immediate", True)),
                )
            elif action == "simulate_event":
                await bridge.simulate_studio_action(str(cmd.get("kind", "")))
            elif action == "broadcast_event":
                p = cmd.get("payload")
                if isinstance(p, dict):
                    await bridge.broadcast(p)
            elif action == "reset_halay":
                await bridge.reset_state()
            elif action == "reload_overlays":
                await broadcast_event({"type": "reload_overlay", "ts": time.time()})
    except WebSocketDisconnect:
        ws_clients.discard(ws)
    except Exception as exc:
        logger.warning("WS client handler closed: %s", exc)
        ws_clients.discard(ws)


if __name__ == "__main__":
    port = int(os.environ.get("HALAY_PORT", "9944"))
    print(f"[+] TikTok LIVE Production Sunucusu: http://127.0.0.1:{port}")
    print(f"[+] PC OBS / TikTok LIVE Studio URL: http://127.0.0.1:{port}/?obs=1")
    print(f"[+] Telefon Ekran Yayini (LAN) URL : http://{LAN_IP}:{port}/?obs=1")
    uvicorn.run(app, host="0.0.0.0", port=port, log_level="warning")
