# -*- coding: utf-8 -*-
"""
100-Track Non-Stop YouTube Halay Jukebox Engine.
Provides instant local .m4a caching (iOS Safari + OBS CEF native AAC compatible),
autonomous lookahead prefetching, category filtering, shuffle, and TikTok chat DJ requests.
"""
from __future__ import annotations

import asyncio
import json
import logging
import random
import re
import subprocess
import time
from pathlib import Path
from typing import Any, Callable, Coroutine, Dict, List, Optional

import yt_dlp

logger = logging.getLogger("halay.jukebox")

BASE_DIR = Path(__file__).resolve().parent
CATALOG_PATH = BASE_DIR / "data" / "halay_100_catalog.json"
CACHE_DIR = BASE_DIR / "static" / "audio" / "halay_cache"
VALID_ID_RE = re.compile(r"^[A-Za-z0-9_-]{11}$")

TR_MAP = str.maketrans("ıİğĞüÜşŞöÖçÇâÂ", "iigguussooccaa")

DEFAULT_LANG_QUERIES: Dict[str, List[str]] = {
    "tr": ["Erik Dalı Gevrektir Oyun Havası", "Ankara Misket Oyun Havası", "Şemmame Halay", "Damat Halayı", "Delilo Halay"],
    "ru": ["Лезгинка Зажигательная Кавказская Свадьба", "Калинка Малинка Remix Dance", "Кавказская Свадебная Танцевальная Музыка"],
    "ar": ["Dabke Arabic Wedding Party Music", "دبكة حماسية أعراس", "Ya Lili Balti Dance"],
    "az": ["Azərbaycan Toy Mahnısı Yallı", "Qarabağ Yallısı Toy", "Şən Azərbaycan Oyun Havası"],
    "en": ["Balkan Beat Party Brass Dance", "Goran Bregovic Kalashnikov Wedding", "International Party Dance Hit"],
    "es": ["Fiesta Cumbia Bailable Mix", "Balkan Fiesta Brass Dance", "Gipsy Rumba Party"],
    "de": ["Balkan Beats Party Dance", "Polka Party Brass Dance", "Festival Party Hit"],
    "fr": ["Soirée Dansante Balkan Fiesta", "Musique Fête Mariage Dance", "Gipsy Party Hit"],
}
_UNSAFE_TITLE_RE = re.compile(r"\b(18\+|nsfw|porn|sex|explicit|erotic)\b", re.IGNORECASE)


def _norm_tr(text: str) -> str:
    return text.translate(TR_MAP).lower().strip()


def _get_ffmpeg_exe() -> Optional[str]:
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception as exc:
        logger.debug("imageio_ffmpeg unavailable: %s", exc)
        return None


class HalayJukeboxService:
    """Manages the 100-track YouTube Halay catalog, iOS-safe .m4a cache, and live DJ queue."""

    def __init__(self, broadcast_fn: Callable[[Dict[str, Any]], Coroutine[Any, Any, None]]) -> None:
        self.broadcast = broadcast_fn
        CACHE_DIR.mkdir(parents=True, exist_ok=True)
        self.tracks: List[Dict[str, Any]] = []
        self.track_map: Dict[str, Dict[str, Any]] = {}
        self.current_id: str = ""
        self.current_requested_by: str = ""
        self.current_requested_lang: str = "tr"
        self.current_requested_flag: str = "🇹🇷"
        self.active_category: str = "all"
        self.shuffle: bool = False
        self.dj_queue: List[Dict[str, Any]] = []
        self._lang_query_cursor: Dict[str, int] = {}
        self._locks: Dict[str, asyncio.Lock] = {}
        self._prefetch_sem = asyncio.Semaphore(2)
        self._search_sem = asyncio.Semaphore(1)
        self._bg_tasks: set[asyncio.Task] = set()
        self.reload_catalog()

    def reload_catalog(self) -> None:
        if not CATALOG_PATH.exists():
            logger.warning("Halay catalog not found at %s", CATALOG_PATH)
            self.tracks = []
            self.track_map = {}
            return
        try:
            raw = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
            self.tracks = [t for t in raw if isinstance(t, dict) and VALID_ID_RE.match(str(t.get("id", "")))]
            for idx, tr in enumerate(self.tracks, start=1):
                tr["index"] = idx
            self.track_map = {t["id"]: t for t in self.tracks}
            if self.tracks and self.current_id not in self.track_map:
                # Pick first cached m4a/mp3 track if available, otherwise #1
                cached_first = next((t["id"] for t in self.tracks if self.get_cached_file(t["id"])), self.tracks[0]["id"])
                self.current_id = cached_first
        except Exception as exc:
            logger.error("Failed to parse catalog %s: %s", CATALOG_PATH, exc)

    def get_cached_file(self, video_id: str) -> Optional[Path]:
        if not VALID_ID_RE.match(video_id):
            return None
        # Prefer iOS Safari native .m4a / .mp3 first
        for ext in ("m4a", "mp3", "mp4"):
            p = CACHE_DIR / f"{video_id}.{ext}"
            if p.exists() and p.stat().st_size > 25_000:
                return p
        return None

    def _serialize_track(self, tr: Dict[str, Any]) -> Dict[str, Any]:
        vid = tr["id"]
        is_cached = self.get_cached_file(vid) is not None
        return {
            **tr,
            "cached": is_cached,
            "stream_url": f"/api/jukebox/stream/{vid}",
        }

    def get_public_state(self) -> Dict[str, Any]:
        cur = self.track_map.get(self.current_id) or (self.tracks[0] if self.tracks else None)
        return {
            "total_tracks": len(self.tracks),
            "cached_count": sum(1 for t in self.tracks if self.get_cached_file(t["id"]) is not None),
            "active_category": self.active_category,
            "shuffle": self.shuffle,
            "requested_by": self.current_requested_by,
            "requested_lang": self.current_requested_lang,
            "requested_flag": self.current_requested_flag,
            "current": self._serialize_track(cur) if cur else None,
            "dj_queue": [
                {
                    "id": q["track"]["id"],
                    "index": q["track"]["index"],
                    "title": q["track"]["title"],
                    "requested_by": q["requested_by"],
                    "requested_lang": q.get("lang", "tr"),
                    "requested_flag": q.get("flag", "🇹🇷"),
                }
                for q in self.dj_queue[:6]
            ],
        }

    def get_catalog_payload(self) -> Dict[str, Any]:
        return {
            **self.get_public_state(),
            "tracks": [self._serialize_track(t) for t in self.tracks],
        }

    def _download_sync(self, video_id: str) -> Optional[Path]:
        existing = self.get_cached_file(video_id)
        if existing:
            return existing

        # Convert any existing webm/opus file via ffmpeg if already downloaded
        ffmpeg_exe = _get_ffmpeg_exe()
        for raw_ext in ("webm", "opus"):
            raw_p = CACHE_DIR / f"{video_id}.{raw_ext}"
            if raw_p.exists() and raw_p.stat().st_size > 25_000 and ffmpeg_exe:
                out_m4a = CACHE_DIR / f"{video_id}.m4a"
                if self._transcode_to_m4a(ffmpeg_exe, raw_p, out_m4a):
                    return out_m4a

        url = f"https://www.youtube.com/watch?v={video_id}"
        out_tmpl = str(CACHE_DIR / f"{video_id}.%(ext)s")
        opts = {
            "format": "140/bestaudio[ext=m4a][filesize<22M]/bestaudio[ext=m4a]/bestaudio[filesize<22M]/bestaudio",
            "outtmpl": out_tmpl,
            "quiet": True,
            "no_warnings": True,
            "noplaylist": True,
            "socket_timeout": 12,
            "retries": 2,
        }
        try:
            with yt_dlp.YoutubeDL(opts) as ydl:
                ydl.download([url])
        except Exception as exc:
            logger.warning("yt-dlp download failed for %s: %s", video_id, exc)
            return None

        ready = self.get_cached_file(video_id)
        if ready:
            return ready

        # Transcode fallback webm/opus -> iOS-compatible AAC .m4a
        if ffmpeg_exe:
            for p in CACHE_DIR.glob(f"{video_id}.*"):
                if p.suffix.lower() in (".webm", ".opus", ".ogg") and p.stat().st_size > 25_000:
                    out_m4a = CACHE_DIR / f"{video_id}.m4a"
                    if self._transcode_to_m4a(ffmpeg_exe, p, out_m4a):
                        return out_m4a
        return None

    @staticmethod
    def _transcode_to_m4a(ffmpeg_exe: str, src: Path, dst: Path) -> bool:
        try:
            subprocess.run(
                [ffmpeg_exe, "-y", "-i", str(src), "-vn", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", str(dst)],
                capture_output=True,
                timeout=35,
                check=False,
            )
            if dst.exists() and dst.stat().st_size > 25_000:
                try:
                    src.unlink(missing_ok=True)
                except OSError:
                    pass
                return True
        except Exception as exc:
            logger.warning("FFmpeg transcode failed for %s: %s", src.name, exc)
        return False

    async def ensure_track_cached(self, video_id: str) -> Optional[Path]:
        if not VALID_ID_RE.match(video_id):
            return None
        cached = self.get_cached_file(video_id)
        if cached:
            return cached
        lock = self._locks.setdefault(video_id, asyncio.Lock())
        async with lock:
            cached = self.get_cached_file(video_id)
            if cached:
                return cached
            return await asyncio.to_thread(self._download_sync, video_id)

    def schedule_lookahead_prefetch(self) -> None:
        if not self.tracks:
            return
        candidates: List[str] = [q["track"]["id"] for q in self.dj_queue[:2]]
        pool = self._filtered_pool()
        if pool:
            cur_pos = next((i for i, t in enumerate(pool) if t["id"] == self.current_id), 0)
            for offset in (1, 2, 3):
                nxt = pool[(cur_pos + offset) % len(pool)]["id"]
                if nxt not in candidates:
                    candidates.append(nxt)

        for vid in candidates[:3]:
            if self.get_cached_file(vid) is None:
                task = asyncio.create_task(self._bg_prefetch_one(vid))
                self._bg_tasks.add(task)
                task.add_done_callback(self._bg_tasks.discard)

        # Background low-priority idle downloader for uncached tracks
        uncached = [t["id"] for t in self.tracks if self.get_cached_file(t["id"]) is None]
        if uncached and len(self._bg_tasks) < 2:
            next_uncached = uncached[0]
            task2 = asyncio.create_task(self._bg_prefetch_one(next_uncached))
            self._bg_tasks.add(task2)
            task2.add_done_callback(self._bg_tasks.discard)

    async def _bg_prefetch_one(self, video_id: str) -> None:
        async with self._prefetch_sem:
            path = await self.ensure_track_cached(video_id)
            if path:
                await self.broadcast({"type": "jukebox_cached", "id": video_id, "cached_count": self.get_public_state()["cached_count"]})

    def _filtered_pool(self) -> List[Dict[str, Any]]:
        if self.active_category == "all":
            return self.tracks
        sub = [t for t in self.tracks if t.get("category") == self.active_category]
        return sub if sub else self.tracks

    async def select_track(
        self,
        video_id: str,
        requested_by: str = "",
        requested_lang: str = "tr",
        requested_flag: str = "🇹🇷",
    ) -> Optional[Dict[str, Any]]:
        tr = self.track_map.get(video_id)
        if not tr:
            return None
        self.current_id = video_id
        self.current_started_ts = time.time()
        self.current_requested_by = str(requested_by or "").strip()
        self.current_requested_lang = (requested_lang or tr.get("lang") or "tr").lower()
        self.current_requested_flag = requested_flag or "🇹🇷"
        self.schedule_lookahead_prefetch()
        payload = {
            "type": "jukebox_play",
            "requested_by": self.current_requested_by,
            "requested_lang": self.current_requested_lang,
            "requested_flag": self.current_requested_flag,
            **self.get_public_state(),
            "ts": time.time(),
        }
        await self.broadcast(payload)
        return payload

    async def advance_next(self, prev_direction: bool = False) -> Optional[Dict[str, Any]]:
        if not self.tracks:
            return None
        if not prev_direction and self.dj_queue:
            req = self.dj_queue.pop(0)
            return await self.select_track(
                req["track"]["id"],
                requested_by=req["requested_by"],
                requested_lang=req.get("lang", "tr"),
                requested_flag=req.get("flag", "🇹🇷"),
            )

        pool = self._filtered_pool()
        if self.shuffle and len(pool) > 1 and not prev_direction:
            choices = [t for t in pool if t["id"] != self.current_id]
            cached_choices = [t for t in choices if self.get_cached_file(t["id"]) is not None]
            pick = random.choice(cached_choices if cached_choices and random.random() < 0.55 else choices)
            return await self.select_track(pick["id"])

        cur_pos = next((i for i, t in enumerate(pool) if t["id"] == self.current_id), 0)
        step = -1 if prev_direction else 1
        nxt = pool[(cur_pos + step) % len(pool)]
        return await self.select_track(nxt["id"])

    async def set_options(self, category: Optional[str] = None, shuffle: Optional[bool] = None) -> Dict[str, Any]:
        if category is not None:
            self.active_category = category
        if shuffle is not None:
            self.shuffle = bool(shuffle)
        self.schedule_lookahead_prefetch()
        st = self.get_public_state()
        await self.broadcast({"type": "jukebox_state", **st})
        return st

    def _search_youtube_sync(self, query: str, lang: str = "tr") -> Optional[Dict[str, Any]]:
        """Search YouTube via yt_dlp for an out-of-catalog multilingual track and cache it locally."""
        clean_q = re.sub(r"\s+", " ", str(query or "")).strip()[:70]
        if not clean_q:
            return None
        opts = {
            "quiet": True,
            "no_warnings": True,
            "noplaylist": True,
            "extract_flat": "in_playlist",
            "skip_download": True,
            "socket_timeout": 10,
        }
        try:
            with yt_dlp.YoutubeDL(opts) as ydl:
                info = ydl.extract_info(f"ytsearch4:{clean_q}", download=False)
        except Exception as exc:
            logger.warning("YouTube search failed for %r: %s", clean_q, exc)
            return None

        entries = (info or {}).get("entries") or []
        picked: Optional[Dict[str, Any]] = None
        for entry in entries:
            if not isinstance(entry, dict):
                continue
            vid = str(entry.get("id") or "")
            if not VALID_ID_RE.match(vid):
                continue
            title = str(entry.get("title") or "").strip()
            if not title or _UNSAFE_TITLE_RE.search(title):
                continue
            if entry.get("is_live") or entry.get("live_status") == "is_live":
                continue
            dur = entry.get("duration")
            if isinstance(dur, (int, float)) and dur > 0 and (dur < 30 or dur > 420):
                continue
            picked = entry
            break

        if not picked:
            return None
        vid = str(picked["id"])
        if vid in self.track_map:
            self._download_sync(vid)
            return self.track_map[vid]

        cached_path = self._download_sync(vid)
        if not cached_path:
            return None

        new_track = {
            "index": len(self.tracks) + 1,
            "id": vid,
            "title": str(picked.get("title") or clean_q)[:80],
            "channel": str(picked.get("uploader") or picked.get("channel") or "Global DJ")[:40],
            "duration": int(picked.get("duration") or 180),
            "category": f"world_{lang}",
            "category_label": f"🌍 {lang.upper()} DJ İstek",
            "lang": lang,
            "url": f"https://www.youtube.com/watch?v={vid}",
        }
        self.tracks.append(new_track)
        self.track_map[vid] = new_track
        logger.info("Cached new [%s] DJ track %s: %s", lang, vid, new_track["title"])
        return new_track

    async def request_by_query(
        self,
        query: str,
        nickname: str,
        play_immediately: bool = False,
        lang: str = "tr",
        flag: str = "🇹🇷",
    ) -> Optional[Dict[str, Any]]:
        use_lang = (lang or "tr").lower()
        use_flag = flag or "🇹🇷"
        raw_query = str(query or "").strip()
        is_bare = (not raw_query) or raw_query.lower() in ("auto", "random", "rastgele")

        if is_bare:
            pool_q = DEFAULT_LANG_QUERIES.get(use_lang, DEFAULT_LANG_QUERIES["tr"])
            cursor = self._lang_query_cursor.get(use_lang, 0)
            raw_query = pool_q[cursor % len(pool_q)]
            self._lang_query_cursor[use_lang] = cursor + 1

        q = _norm_tr(raw_query)
        matched: Optional[Dict[str, Any]] = None

        if q.isdigit() and self.tracks:
            idx_num = int(q)
            if 1 <= idx_num <= len(self.tracks):
                matched = self.tracks[idx_num - 1]

        # Prefer already-cached language-tagged dynamic tracks on bare non-Turkish requests first
        if not matched and is_bare and use_lang != "tr":
            lang_cached = [
                t for t in self.tracks
                if t.get("lang") == use_lang and self.get_cached_file(t["id"]) is not None and t["id"] != self.current_id
            ]
            if lang_cached:
                matched = random.choice(lang_cached)

        if not matched and self.tracks:
            words = [w for w in re.split(r"\s+", q) if len(w) >= 2]
            best_score = 0
            for tr in self.tracks:
                hay = _norm_tr(f"{tr['title']} {tr.get('category_label', '')} {tr.get('channel', '')} {tr.get('lang', '')}")
                score = sum(3 if w in _norm_tr(tr["title"]) else (1 if w in hay else 0) for w in words)
                if q and q in hay:
                    score += 6
                if use_lang != "tr" and tr.get("lang") == use_lang:
                    score += 4
                if score > best_score:
                    best_score = score
                    matched = tr
            # Require a stronger match when a non-Turkish viewer asks for a custom song
            min_accept = 2 if (use_lang == "tr" or is_bare) else 4
            if best_score < min_accept:
                matched = None

        if not matched:
            await self.broadcast({
                "type": "jukebox_searching",
                "query": raw_query[:50],
                "requested_by": nickname,
                "lang": use_lang,
                "flag": use_flag,
            })
            async with self._search_sem:
                matched = await asyncio.to_thread(self._search_youtube_sync, raw_query, use_lang)

        # Graceful fallback if YouTube throttled/failed
        if not matched and self.tracks:
            cached_pool = [t for t in self.tracks if self.get_cached_file(t["id"]) is not None and t["id"] != self.current_id]
            matched = random.choice(cached_pool or self.tracks)

        if not matched:
            return None

        # Interrupt normal Halay immediately; if a requested/regional song is already playing, queue until it finishes
        if not self.current_requested_by and (play_immediately or self.get_cached_file(matched["id"]) is not None):
            return await self.select_track(
                matched["id"],
                requested_by=nickname,
                requested_lang=use_lang,
                requested_flag=use_flag,
            )

        if len(self.dj_queue) < 12 and all(item["track"]["id"] != matched["id"] for item in self.dj_queue):
            self.dj_queue.append({
                "track": matched,
                "requested_by": nickname,
                "lang": use_lang,
                "flag": use_flag,
            })
        self.schedule_lookahead_prefetch()
        await self.broadcast({
            "type": "jukebox_dj_queued",
            "track": self._serialize_track(matched),
            "requested_by": nickname,
            "requested_lang": use_lang,
            "requested_flag": use_flag,
            **self.get_public_state(),
        })
        return matched
