# -*- coding: utf-8 -*-
"""
Autonomous 100-Track YouTube Halay Harvester & Instant Audio Pre-Cacher.
Uses yt-dlp with concurrent workers to build data/halay_100_catalog.json
and pre-caches starter .m4a tracks for 0ms instant broadcast playback.
"""
from __future__ import annotations

import concurrent.futures
import io
import json
import os
import re
import sys
import time
from pathlib import Path
from typing import Any, Dict, List

if sys.stdout and hasattr(sys.stdout, "buffer"):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

import yt_dlp

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
CACHE_DIR = BASE_DIR / "static" / "audio" / "halay_cache"
CATALOG_PATH = DATA_DIR / "halay_100_catalog.json"

SEARCH_BUCKETS: List[Dict[str, Any]] = [
    {
        "category": "dugun_semmame",
        "label": "💃 Düğün & Şemmame",
        "queries": [
            "ytsearch28:davul zurna halay düğün şemmame delilo",
            "ytsearch20:halay potpori hareketli düğün halayları",
        ],
    },
    {
        "category": "agir_grani",
        "label": "🔥 Ağır & Grani Halay",
        "queries": [
            "ytsearch25:grani ağır halay davul zurna diyarbakır mardin",
            "ytsearch18:urfa gaziantep halay davul zurna",
        ],
    },
    {
        "category": "ankara_oyun",
        "label": "⚡ Erik Dalı & Oyun Havası",
        "queries": [
            "ytsearch24:erik dalı ankara oyun havaları düğün hareketli",
            "ytsearch16:çiftetelli roman havası düğün",
        ],
    },
    {
        "category": "karadeniz_horon",
        "label": "🌊 Karadeniz Horon",
        "queries": [
            "ytsearch22:karadeniz düğün horon kemençe hareketli",
        ],
    },
    {
        "category": "dogu_govend",
        "label": "🥁 Yöresel Meydan Halayı",
        "queries": [
            "ytsearch22:sivas elazığ erzincan dik halay davul zurna",
            "ytsearch18:hakkari yüksekova cizre halay",
        ],
    },
    {
        "category": "tiktok_remix",
        "label": "🚀 TikTok Remix Halay",
        "queries": [
            "ytsearch24:halay remix bass davul zurna tiktok",
        ],
    },
]

VALID_ID_RE = re.compile(r"^[A-Za-z0-9_-]{11}$")


def _search_single_query(bucket: Dict[str, Any], query: str) -> List[Dict[str, Any]]:
    found: List[Dict[str, Any]] = []
    opts = {
        "quiet": True,
        "no_warnings": True,
        "extract_flat": "in_playlist",
        "skip_download": True,
        "ignoreerrors": True,
    }
    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(query, download=False)
            entries = (info or {}).get("entries") or []
            for e in entries:
                if not e:
                    continue
                vid = str(e.get("id") or "").strip()
                title = str(e.get("title") or "").strip()
                dur = int(e.get("duration") or 0)
                if not VALID_ID_RE.match(vid) or not title:
                    continue
                if dur < 50 or dur > 1800:
                    continue
                low_t = title.lower()
                if any(bad in low_t for bad in ("shorts", "#shorts", "dersi", "nasıl oynanır", "öğreniyorum")):
                    continue
                channel = str(e.get("uploader") or e.get("channel") or "Halay Meydanı").strip()
                found.append({
                    "id": vid,
                    "title": title[:95],
                    "channel": channel[:42],
                    "duration": dur,
                    "category": bucket["category"],
                    "category_label": bucket["label"],
                    "url": f"https://www.youtube.com/watch?v={vid}",
                    "thumb": f"https://i.ytimg.com/vi/{vid}/hqdefault.jpg",
                })
    except Exception as exc:
        print(f"[WARN] Query failed ({query}): {exc}")
    return found


def harvest_100_tracks() -> List[Dict[str, Any]]:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    CACHE_DIR.mkdir(parents=True, exist_ok=True)

    tasks = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        for b in SEARCH_BUCKETS:
            for q in b["queries"]:
                tasks.append(pool.submit(_search_single_query, b, q))

        by_cat: Dict[str, List[Dict[str, Any]]] = {b["category"]: [] for b in SEARCH_BUCKETS}
        seen_ids: set[str] = set()
        for fut in concurrent.futures.as_completed(tasks):
            for item in fut.result():
                vid = item["id"]
                if vid in seen_ids:
                    continue
                seen_ids.add(vid)
                by_cat[item["category"]].append(item)

    # Interleave categories so continuous playback feels rich & dynamic, up to exactly 100 tracks
    interleaved: List[Dict[str, Any]] = []
    cat_keys = [b["category"] for b in SEARCH_BUCKETS]
    round_idx = 0
    while len(interleaved) < 100:
        added_in_round = False
        for ck in cat_keys:
            if round_idx < len(by_cat[ck]):
                interleaved.append(by_cat[ck][round_idx])
                added_in_round = True
                if len(interleaved) >= 100:
                    break
        if not added_in_round:
            break
        round_idx += 1

    for idx, tr in enumerate(interleaved, start=1):
        tr["index"] = idx

    CATALOG_PATH.write_text(json.dumps(interleaved, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[+] Saved {len(interleaved)} verified YouTube Halay tracks -> {CATALOG_PATH}")
    return interleaved


def _precache_track(track: Dict[str, Any]) -> bool:
    vid = track["id"]
    # Check existing cached audio
    for ext in ("m4a", "webm", "mp3", "opus"):
        p = CACHE_DIR / f"{vid}.{ext}"
        if p.exists() and p.stat().st_size > 25_000:
            return True

    out_tmpl = str(CACHE_DIR / f"{vid}.%(ext)s")
    opts = {
        "format": "bestaudio[ext=m4a][filesize<18M]/bestaudio[ext=webm][filesize<18M]/bestaudio[ext=m4a]/bestaudio",
        "outtmpl": out_tmpl,
        "quiet": True,
        "no_warnings": True,
        "noplaylist": True,
        "socket_timeout": 12,
        "retries": 2,
    }
    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            ydl.download([track["url"]])
        for p in CACHE_DIR.glob(f"{vid}.*"):
            if p.suffix.lower() in (".m4a", ".webm", ".mp3", ".opus", ".mp4") and p.stat().st_size > 25_000:
                print(f"  [CACHED] #{track['index']} {track['title'][:52]} ({p.stat().st_size // 1024} KB)")
                return True
    except Exception as exc:
        print(f"  [SKIP] #{track['index']} ({vid}): {exc}")
    return False


if __name__ == "__main__":
    t0 = time.time()
    tracks = harvest_100_tracks()
    # Pre-cache up to 6 short/medium tracks (<420s) so Track 1+ play in 0.05s immediately!
    short_candidates = [t for t in tracks if 60 <= t["duration"] <= 420][:8]
    cached_ok = 0
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        for ok in pool.map(_precache_track, short_candidates):
            if ok:
                cached_ok += 1
    # Move cached tracks to the very front of the catalog (#1..#N) so initial load has 0ms wait!
    cached_ids = {
        p.stem for p in CACHE_DIR.iterdir()
        if p.is_file() and p.suffix.lower() in (".m4a", ".webm", ".mp3", ".opus", ".mp4") and p.stat().st_size > 25_000
    }
    tracks.sort(key=lambda x: (0 if x["id"] in cached_ids else 1, x["index"]))
    for idx, tr in enumerate(tracks, start=1):
        tr["index"] = idx
    CATALOG_PATH.write_text(json.dumps(tracks, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[DONE] Catalog={len(tracks)} tracks | Instant-Cached={len(cached_ids)} tracks in {time.time() - t0:.1f}s")
