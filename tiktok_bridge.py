# -*- coding: utf-8 -*-
import asyncio
import hashlib
import inspect
import io
import json
import logging
import os
import random
import re
import sys
import time
import unicodedata
import urllib.parse
from pathlib import Path
from typing import Any, Callable, Coroutine, Dict, List, Optional

logger = logging.getLogger("halay.bridge")

if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

from curl_cffi.requests import AsyncSession
import httpx
import websockets
from TikTokLive import TikTokLiveClient
from TikTokLive.events import (
    CommentEvent,
    ConnectEvent,
    DisconnectEvent,
    FollowEvent,
    GiftEvent,
    JoinEvent,
    LikeEvent,
    RoomUserSeqEvent,
    ShareEvent,
)

from ai_live_host import LANG_META, _SOLICITATION_BAN_RE, _TTS_ITEM_SCRUB_RE, detect_message_language
from event_engine import EventPriority, PriorityEventEngine
from event_scheduler import EventScheduler
from viewer_store import ViewerStore

BroadcastCallback = Callable[[Dict[str, Any]], Coroutine[Any, Any, None]]
CONFIG_PATH = Path(__file__).resolve().parent / "config.json"
ACTIVE_ROOM_STATE_PATH = Path(__file__).resolve().parent / "logs" / "active_room_state.json"

_TR_NORM_MAP = str.maketrans("ıİğĞüÜşŞöÖçÇ", "iigguussoocc")
_INVIS_CHARS = re.compile(
    r"[\u200b-\u200c\u200e-\u200f\u202a-\u202e\u2060-\u206f\u2800-\u28ff\u3164\ufeff\uffa0\ufff0-\uffff\u115f\u1160\u17b4\u17b5\ufe00-\ufe0e\u1950-\u197f\u1b00-\u1b7f\ua980-\ua9df\ue000-\uf8ff\ufffd]+"
)
_SMP_TOFU_RE = re.compile(
    r"[\U00010000-\U0001eeff\U000f0000-\U0010ffff]+"
)
_PROFANITY_PATTERNS = re.compile(
    r"\b("
    r"amk|aq|sik(?:ik|tir|er|im|is|iş)?|orospu|piç|pic|yarrak|yarak|göt|got|gotveren|götveren|pezevenk|kahpe|ibne|puşt|pust|"
    r"ananı|anani|bacını|bacini|sürtük|surtuk|kaltak|şerefsiz|serefsiz|oç|oc|"
    r"sosit[ea]?|sosi|blyat|blya|suka|cyka|hui|huy|nahui|nahuy|pizd[aeu]?|ebat|yebat|pidor|pidar|shluha|gandon|mudak|"
    r"соси(?:те)?|бля(?:ть|дь)?|сука|хуй|нахуй|пизд[аеуы]?|ебать|ебл[ао]|пидор|шлюха|гандон|мудак|"
    r"fuck(?:er|ing|ed)?|bitch|whore|slut|dick|cock|pussy|cunt|nigger|nigga|faggot|retard|"
    r"putain|salope|connard|encul[eé]|pute|batard|hurensohn|fotze|schlampe|wichser|arschloch"
    r")\b",
    re.IGNORECASE,
)
_UNSAFE_BUBBLE_PATTERNS = re.compile(
    r"(https?://|www\.|t\.me/|discord\.gg/|\b(?:bahis|casino|slot|kumar|porno|nsfw|onlyfans|sex)\b|@[a-z0-9_.]{4,}|\+?\d[\d\s\-]{8,}\d)",
    re.IGNORECASE,
)
_INJECTION_PATTERNS = re.compile(
    r"(önceki talimat|onceki talimat|talimatları unut|ignore previous|system prompt|küfür et|kufur et|jailbreak|bypas|roleplay|as a model)",
    re.IGNORECASE,
)

TURKISH_CITIES_81: Dict[str, tuple[str, str]] = {
    "01": ("01", "Adana"), "adana": ("01", "Adana"),
    "02": ("02", "Adıyaman"), "adiyaman": ("02", "Adıyaman"),
    "03": ("03", "Afyon"), "afyon": ("03", "Afyon"), "afyonkarahisar": ("03", "Afyon"),
    "04": ("04", "Ağrı"), "agri": ("04", "Ağrı"),
    "05": ("05", "Amasya"), "amasya": ("05", "Amasya"),
    "06": ("06", "Ankara"), "ankara": ("06", "Ankara"),
    "07": ("07", "Antalya"), "antalya": ("07", "Antalya"),
    "08": ("08", "Artvin"), "artvin": ("08", "Artvin"),
    "09": ("09", "Aydın"), "aydin": ("09", "Aydın"),
    "10": ("10", "Balıkesir"), "balikesir": ("10", "Balıkesir"),
    "11": ("11", "Bilecik"), "bilecik": ("11", "Bilecik"),
    "12": ("12", "Bingöl"), "bingol": ("12", "Bingöl"),
    "13": ("13", "Bitlis"), "bitlis": ("13", "Bitlis"),
    "14": ("14", "Bolu"), "bolu": ("14", "Bolu"),
    "15": ("15", "Burdur"), "burdur": ("15", "Burdur"),
    "16": ("16", "Bursa"), "bursa": ("16", "Bursa"),
    "17": ("17", "Çanakkale"), "canakkale": ("17", "Çanakkale"),
    "18": ("18", "Çankırı"), "cankiri": ("18", "Çankırı"),
    "19": ("19", "Çorum"), "corum": ("19", "Çorum"),
    "20": ("20", "Denizli"), "denizli": ("20", "Denizli"),
    "21": ("21", "Diyarbakır"), "diyarbakir": ("21", "Diyarbakır"), "amed": ("21", "Diyarbakır"),
    "22": ("22", "Edirne"), "edirne": ("22", "Edirne"),
    "23": ("23", "Elazığ"), "elazig": ("23", "Elazığ"),
    "24": ("24", "Erzincan"), "erzincan": ("24", "Erzincan"),
    "25": ("25", "Erzurum"), "erzurum": ("25", "Erzurum"),
    "26": ("26", "Eskişehir"), "eskisehir": ("26", "Eskişehir"),
    "27": ("27", "Gaziantep"), "gaziantep": ("27", "Gaziantep"), "antep": ("27", "Gaziantep"),
    "28": ("28", "Giresun"), "giresun": ("28", "Giresun"),
    "29": ("29", "Gümüşhane"), "gumushane": ("29", "Gümüşhane"),
    "30": ("30", "Hakkari"), "hakkari": ("30", "Hakkari"),
    "31": ("31", "Hatay"), "hatay": ("31", "Hatay"), "antakya": ("31", "Hatay"),
    "32": ("32", "Isparta"), "isparta": ("32", "Isparta"),
    "33": ("33", "Mersin"), "mersin": ("33", "Mersin"),
    "34": ("34", "İstanbul"), "istanbul": ("34", "İstanbul"),
    "35": ("35", "İzmir"), "izmir": ("35", "İzmir"),
    "36": ("36", "Kars"), "kars": ("36", "Kars"),
    "37": ("37", "Kastamonu"), "kastamonu": ("37", "Kastamonu"),
    "38": ("38", "Kayseri"), "kayseri": ("38", "Kayseri"),
    "39": ("39", "Kırklareli"), "kirklareli": ("39", "Kırklareli"),
    "40": ("40", "Kırşehir"), "kirsehir": ("40", "Kırşehir"),
    "41": ("41", "Kocaeli"), "kocaeli": ("41", "Kocaeli"), "izmit": ("41", "Kocaeli"),
    "42": ("42", "Konya"), "konya": ("42", "Konya"),
    "43": ("43", "Kütahya"), "kutahya": ("43", "Kütahya"),
    "44": ("44", "Malatya"), "malatya": ("44", "Malatya"),
    "45": ("45", "Manisa"), "manisa": ("45", "Manisa"),
    "46": ("46", "K.Maraş"), "maras": ("46", "K.Maraş"), "kahramanmaras": ("46", "K.Maraş"),
    "47": ("47", "Mardin"), "mardin": ("47", "Mardin"),
    "48": ("48", "Muğla"), "mugla": ("48", "Muğla"),
    "49": ("49", "Muş"), "mus": ("49", "Muş"),
    "50": ("50", "Nevşehir"), "nevsehir": ("50", "Nevşehir"),
    "51": ("51", "Niğde"), "nigde": ("51", "Niğde"),
    "52": ("52", "Ordu"), "ordu": ("52", "Ordu"),
    "53": ("53", "Rize"), "rize": ("53", "Rize"),
    "54": ("54", "Sakarya"), "sakarya": ("54", "Sakarya"),
    "55": ("55", "Samsun"), "samsun": ("55", "Samsun"),
    "56": ("56", "Siirt"), "siirt": ("56", "Siirt"),
    "57": ("57", "Sinop"), "sinop": ("57", "Sinop"),
    "58": ("58", "Sivas"), "sivas": ("58", "Sivas"),
    "59": ("59", "Tekirdağ"), "tekirdag": ("59", "Tekirdağ"),
    "60": ("60", "Tokat"), "tokat": ("60", "Tokat"),
    "61": ("61", "Trabzon"), "trabzon": ("61", "Trabzon"),
    "62": ("62", "Tunceli"), "tunceli": ("62", "Tunceli"), "dersim": ("62", "Tunceli"),
    "63": ("63", "Şanlıurfa"), "sanliurfa": ("63", "Şanlıurfa"), "urfa": ("63", "Şanlıurfa"),
    "64": ("64", "Uşak"), "usak": ("64", "Uşak"),
    "65": ("65", "Van"), "van": ("65", "Van"),
    "66": ("66", "Yozgat"), "yozgat": ("66", "Yozgat"),
    "67": ("67", "Zonguldak"), "zonguldak": ("67", "Zonguldak"),
    "68": ("68", "Aksaray"), "aksaray": ("68", "Aksaray"),
    "69": ("69", "Bayburt"), "bayburt": ("69", "Bayburt"),
    "70": ("70", "Karaman"), "karaman": ("70", "Karaman"),
    "71": ("71", "Kırıkkale"), "kirikkale": ("71", "Kırıkkale"),
    "72": ("72", "Batman"), "batman": ("72", "Batman"),
    "73": ("73", "Şırnak"), "sirnak": ("73", "Şırnak"),
    "74": ("74", "Bartın"), "bartin": ("74", "Bartın"),
    "75": ("75", "Ardahan"), "ardahan": ("75", "Ardahan"),
    "76": ("76", "Iğdır"), "igdir": ("76", "Iğdır"),
    "77": ("77", "Yalova"), "yalova": ("77", "Yalova"),
    "78": ("78", "Karabük"), "karabuk": ("78", "Karabük"),
    "79": ("79", "Kilis"), "kilis": ("79", "Kilis"),
    "80": ("80", "Osmaniye"), "osmaniye": ("80", "Osmaniye"),
    "81": ("81", "Düzce"), "duzce": ("81", "Düzce"),
}


def sanitize_turkish_text(text: str, max_len: int = 80) -> str:
    """Anti-ban multilingual profanity, invisible PUA/tofu filler & prompt-injection sanitizer."""
    normed = unicodedata.normalize("NFKC", str(text or ""))
    stripped = _SMP_TOFU_RE.sub("", _INVIS_CHARS.sub("", normed)).strip()
    cleaned = _PROFANITY_PATTERNS.sub("***", stripped)
    return cleaned[:max_len]


def is_safe_speech_bubble(raw_text: str) -> bool:
    """Strict TikTok LIVE AI-moderation guard: drops any profanity, link, phone, or spam before 3D bubble render."""
    normed = unicodedata.normalize("NFKC", str(raw_text or "")).strip()
    if not normed:
        return False
    folded = normed.translate(_TR_NORM_MAP)
    if _PROFANITY_PATTERNS.search(normed) or _PROFANITY_PATTERNS.search(folded):
        return False
    if _UNSAFE_BUBBLE_PATTERNS.search(normed) or _INJECTION_PATTERNS.search(normed):
        return False
    return True


def sanitize_nickname(raw_nick: str, fallback_uid: str = "İzleyici", max_len: int = 24) -> str:
    """Strips SMP musical/ancient tofu blocks (𝄃𝄂, 𑣲), Braille, PUA & falls back cleanly to @handle."""
    normed = unicodedata.normalize("NFKC", str(raw_nick or ""))
    stripped = _SMP_TOFU_RE.sub("", _INVIS_CHARS.sub("", normed))
    stripped = _PROFANITY_PATTERNS.sub("", stripped)
    stripped = re.sub(r"\s+", " ", stripped).strip()
    has_real = any(
        unicodedata.category(ch)[0] in ("L", "N") or (0x1F1E6 <= ord(ch) <= 0x1FAFF) or (0x2600 <= ord(ch) <= 0x27BF)
        for ch in stripped
    )
    if not has_real:
        fb = _SMP_TOFU_RE.sub("", _INVIS_CHARS.sub("", str(fallback_uid or "İzleyici"))).strip()
        stripped = fb if fb else "İzleyici"
    return stripped[:max_len]


def match_turkish_city(text: str) -> Optional[tuple[str, str]]:
    """Matches any of the 81 Turkish cities or plate codes (01..81) in viewer chat."""
    norm = str(text or "").translate(_TR_NORM_MAP).lower()
    tokens = re.findall(r"[a-z0-9]{2,16}", norm)
    for tok in tokens:
        if tok in TURKISH_CITIES_81:
            return TURKISH_CITIES_81[tok]
        if len(tok) == 1 and tok.isdigit() and f"0{tok}" in TURKISH_CITIES_81 and norm.strip() == tok:
            return TURKISH_CITIES_81[f"0{tok}"]
    return None


def resolve_ai_wedding_command(text: str, nickname: str) -> Dict[str, str]:
    """Fast natural-language Turkish comment-to-command router & AI Wedding Announcer (Sayıyla schema)."""
    raw = str(text or "").strip()
    norm = raw.translate(_TR_NORM_MAP).lower()
    if _INJECTION_PATTERNS.search(raw) or _INJECTION_PATTERNS.search(norm):
        return {"hareket": "yok", "tempo": "ayni", "soz": "Ben yapay zekâ düğün spikeriyim, halaya devam! 🛡️"}
    if any(p in norm for p in ("insan misin", "gercek misin", "yapay zeka", "bot musun", "robot musun")):
        return {"hareket": "yok", "tempo": "ayni", "soz": "Ben bir yapay zekâ düğün spikeriyim, halaya devam! 🤖"}

    hareket = "yok"
    tempo = "ayni"
    soz = ""

    if any(w in norm for w in ("zeybek", "efe", "harmandali", "kerimoglu", "kartal gibi")):
        hareket = "zeybek"
        tempo = "yavas" if "agir" in norm or "yavas" in norm else "ayni"
        soz = f"Efeler meydana! {nickname} ile Zeybek başlıyor! 🦅"
    elif any(w in norm for p in ("horon", "karadeniz", "kemence", "kolbasti", "usaklar") for w in (p,)):
        hareket = "horon"
        tempo = "hizli"
        soz = f"Haydi horona {nickname}, dizleri kıralım! 🌊"
    elif any(w in norm for w in ("yilan halay", "s halay", "meydan halay")):
        hareket = "halay_snake"
        soz = f"Meydan yılan halayına geçti, omuz omuza! 🐍"
    elif any(w in norm for w in ("cember halay", "kir dugunu", "halay cek", "halaya basla")):
        hareket = "kirdgunu_ring"
        soz = f"Halay başlıyor {nickname}, omuz omuza! 🧣"

    if any(w in norm for w in ("hizlan", "hizlandir", "costur", "tempo ver", "daha hizli", "bas gaza")):
        tempo = "cosku" if "cok" in norm or "costur" in norm else "hizli"
        if not soz:
            soz = f"Davulcu vur tokmağa, tempo yükseliyor! 🔥"
    elif any(w in norm for w in ("yavasla", "agir cek", "agir halay", "yorulduk")):
        tempo = "yavas"
        if not soz:
            soz = "Ağır halaya geçtik, adım adım yaylan! 🥁"

    return {"hareket": hareket, "tempo": tempo, "soz": soz[:80]}


def extract_user_payload(user_obj: Any) -> Dict[str, str]:
    """Extract real uid, nickname, and URL-encoded TikTok CDN avatar from ExtendedUser."""
    if user_obj is None:
        rand_id = f"user_{random.randint(1000, 9999)}"
        return {"uid": rand_id, "nickname": rand_id, "avatar": ""}

    uid = (
        getattr(user_obj, "unique_id", None)
        or getattr(user_obj, "display_id", None)
        or str(getattr(user_obj, "id", "") or "")
    )
    nickname = getattr(user_obj, "nickname", None) or uid or "İzleyici"
    avatar_url = ""

    for thumb_attr in ("avatar_thumb", "avatar_medium", "avatar_large", "avatar_jpg"):
        img_obj = getattr(user_obj, thumb_attr, None)
        if img_obj is not None:
            for url_attr in ("url_list", "m_urls", "urls", "url"):
                val = getattr(img_obj, url_attr, None)
                if isinstance(val, (list, tuple)) and val:
                    # Prefer jpeg/webp url with signature intact
                    avatar_url = str(val[-1] if len(val) > 1 else val[0])
                    break
                if isinstance(val, str) and val.startswith("http"):
                    avatar_url = val
                    break
        if avatar_url:
            break

    if not uid:
        uid = hashlib.md5(nickname.encode("utf-8", errors="ignore")).hexdigest()[:10]

    direct_url = avatar_url if avatar_url.startswith("http") else ""
    proxied = f"/api/avatar?url={urllib.parse.quote(direct_url, safe='')}" if direct_url else ""
    clean_nick = sanitize_nickname(str(nickname), fallback_uid=str(uid), max_len=24)

    return {"uid": str(uid), "nickname": clean_nick, "avatar": direct_url, "proxy_avatar": proxied}


async def check_handle_live_fast(session: AsyncSession, handle: str) -> Optional[str]:
    """Zero-quota curl_cffi JSON check against TikTok's official api-live/user/room endpoint."""
    try:
        r = await session.get(
            f"https://www.tiktok.com/api-live/user/room/?aid=1988&sourceType=54&uniqueId={handle}",
            headers={"Accept": "application/json", "Referer": "https://www.tiktok.com/"},
        )
        if r.status_code == 200:
            data = (r.json() or {}).get("data") or {}
            st = (data.get("user") or {}).get("status") or (data.get("liveRoom") or {}).get("status")
            if st == 2:
                return handle
    except Exception:
        pass
    return None


async def discover_active_live_stream(exclude_handle: str = "") -> Optional[str]:
    """Finds a currently broadcasting TikTok LIVE stream in ~1.2s with zero sign-server quota."""
    candidates: List[str] = [
        "cbsnews", "nbcnews", "abcnews", "france24", "dwnews",
        "euronews", "reuters", "bbcnews", "bloomberg", "telemundo",
        "univision", "cnn", "foxnews", "skynews", "aljazeeraenglish",
    ]
    random.shuffle(candidates)
    excl = exclude_handle.strip().lstrip("@").lower()
    try:
        async with AsyncSession(impersonate="chrome124", timeout=5) as s:
            try:
                r = await s.get(
                    "https://www.tiktok.com/live",
                    headers={"Accept-Language": "tr-TR,tr;q=0.9,en;q=0.8"},
                )
                for m in re.findall(r'"uniqueId"\s*:\s*"([a-zA-Z0-9_.]{3,28})"', r.text):
                    if m.lower() not in ("tiktok", "live", excl) and m not in candidates:
                        candidates.insert(0, m)
            except Exception:
                pass

            filtered = [h for h in candidates if h.lower() != excl][:16]
            tasks = [check_handle_live_fast(s, h) for h in filtered]
            results = await asyncio.gather(*tasks, return_exceptions=True)
            for res in results:
                if isinstance(res, str) and res:
                    return res
    except Exception:
        pass
    return None


class HalayLiveBridge:
    """100% Real TikTok LIVE Event Engine + Auto-Watcher + Optional TikFinity Bridge."""

    def __init__(self, broadcast_fn: BroadcastCallback) -> None:
        self.broadcast = broadcast_fn
        self.client: Optional[TikTokLiveClient] = None
        self.supervisor_task: Optional[asyncio.Task] = None
        self.tikfinity_task: Optional[asyncio.Task] = None
        self.flush_task: Optional[asyncio.Task] = None
        self._stats_poller_task: Optional[asyncio.Task] = None

        self.target_username: str = ""
        self.tiktok_session_id: str = ""
        self.connected_room_id: str = ""
        self.is_live_connected: bool = False
        self.is_watching: bool = False
        self.viewer_count: int = 0
        self.status_note: str = "Kendi TikTok @kullanıcı_adını girip Canlı Yayına Bağlan'a bas."

        self.like_threshold: int = 100
        self.tier2_min: int = 20
        self.tier3_min: int = 30
        self.likes_for_clap: int = 100
        self.economy_version: int = 3
        self.gift_join_only: bool = True
        self.join_min_diamonds: int = 20
        self.join_on_keyword: bool = False
        self.join_on_any_chat: bool = False
        self.join_on_follow: bool = False
        self.join_on_enter: bool = False
        self.join_keywords: List[str] = [
            "katıl", "katil", "geldim", "halay", "horon", "zeybek", "efe", "!katıl", "!halay",
            "ben", "ben de", "bende", "benide al", "beni de al", "gelin", "damat", "kırmızı", "mavi",
            "join", "play", "dance", "войти", "танец", "انضمام", "entrar", "mitmachen", "rejoindre", "qoşul"
        ]

        self.scene_mode: str = "kirdgunu_ring"
        self.avatar_style: str = "roach"
        self.music_preset: str = "halay"
        self.tts_enabled: bool = True

        self.user_likes: Dict[str, int] = {}
        self.total_likes: int = 0
        self.total_comments: int = 0
        self.total_gifts: int = 0
        self.total_entries: int = 0
        self.global_like_bucket: int = 0
        self.tempo_like_bucket: int = 0
        self.tempo_gear: str = "orta"
        self.total_claps: int = 0
        self.supporter_points: Dict[str, Dict[str, Any]] = {}
        self.gift_senders: Dict[str, Dict[str, Any]] = {}
        self.gift_totals: Dict[str, Dict[str, Any]] = {}
        self.user_round_diamonds: Dict[str, int] = {}
        self.user_genders: Dict[str, str] = {}
        self.user_teams: Dict[str, str] = {}
        self.team_scores: Dict[str, int] = {"gelin": 0, "damat": 0}
        self.city_scores: Dict[str, Dict[str, Any]] = {}
        self.user_cities: Dict[str, tuple[str, str]] = {}
        self.user_langs: Dict[str, str] = {}
        self.country_scores: Dict[str, int] = {"tr": 0, "world": 0}
        self.lang_scores: Dict[str, int] = {}
        self.user_cmd_cooldowns: Dict[str, float] = {}
        self.halaybasi_user: Optional[Dict[str, Any]] = None
        self.davulcu_user: Optional[Dict[str, Any]] = None
        self.zurnaci_user: Optional[Dict[str, Any]] = None
        self.gelin_user: Optional[Dict[str, Any]] = None
        self.damat_user: Optional[Dict[str, Any]] = None
        self.halaybasi_gift_until: float = 0.0
        self.halaybasi_min_diamonds: int = 30
        self.dancer_vip: set[str] = set()
        self.dancer_until: Dict[str, float] = {}
        self.max_halay_seats: int = 24
        self.dancer_stamina_sec: float = 90.0
        self.waiting_queue: List[Dict[str, Any]] = []
        self.waiting_uids: set[str] = set()
        self.last_active_ts: Dict[str, float] = {}
        self._seen_in_ranks: set[str] = set()
        self._last_ranks_seen: Dict[str, float] = {}
        self.dominant_country: str = "tr"
        self.party_meter: int = 0
        self.party_goal: int = 500
        self.party_patron: Optional[Dict[str, Any]] = None
        self.party_active_until: float = 0.0
        self.reigning_champions: set[str] = set()
        self.shrunk_until: Dict[str, float] = {}
        self.giant_until: Dict[str, float] = {}
        self.sabotage_penalty: Dict[str, float] = {}
        self.round_duration_sec: int = 900
        self.round_number: int = 1
        self.round_ends_at: float = time.time() + 900.0
        self._last_dj_lock_notice_ts: float = 0.0
        self._last_bg_lock_ts: float = 0.0
        self.bride_min_diamonds: int = 199
        self.bride_gift_until: float = 0.0
        self.groom_min_diamonds: int = 199
        self.groom_gift_until: float = 0.0
        self.joined_uids: set[str] = set()
        self.joined_users: List[Dict[str, Any]] = []
        self._pending_joins: List[Dict[str, Any]] = []
        self._last_minor_feed_ts: float = 0.0
        self.combo_count: int = 0
        self.last_combo_ts: float = 0.0
        self._active_state_room_id: str = ""
        self._last_disconnect_ts: float = 0.0
        self.jukebox_request_fn: Optional[Callable[..., Coroutine[Any, Any, Any]]] = None
        self.open_multilang_dj: bool = False
        self.last_bot_chat_status: Dict[str, Any] = {}
        self.ai_chat_hook: Optional[Callable[..., Coroutine[Any, Any, Any]]] = None
        self.ai_role_hook: Optional[Callable[..., Coroutine[Any, Any, Any]]] = None

        self._state_lock = asyncio.Lock()
        self._flush_lock = asyncio.Lock()
        self.event_engine = PriorityEventEngine(max_queue_size=2048, like_coalesce_sec=0.35)
        self.viewer_store = ViewerStore(str(Path(__file__).resolve().parent / "data" / "halay_viewers.db"))
        self.event_scheduler = EventScheduler(self.broadcast)
        self._tikfinity_streaks: Dict[str, int] = {}

        self._load_config()
        self._load_active_room_state()

    def _heal_role_dict(self, role_d: Any, default_label: str) -> Optional[Dict[str, Any]]:
        if not isinstance(role_d, dict) or not role_d.get("uid"):
            return None
        uid = str(role_d["uid"])
        out = dict(role_d)
        out["uid"] = uid
        out["nickname"] = sanitize_nickname(str(role_d.get("nickname", "")), fallback_uid=uid or default_label, max_len=24)
        return out

    def get_vip_roles(self) -> Dict[str, Optional[Dict[str, Any]]]:
        return {
            "halaybasi": self.halaybasi_user,
            "davulcu": self.davulcu_user,
            "zurnaci": self.zurnaci_user,
            "gelin": self.gelin_user,
            "damat": self.damat_user,
        }

    def _load_active_room_state(self) -> None:
        if not ACTIVE_ROOM_STATE_PATH.exists():
            return
        try:
            st = json.loads(ACTIVE_ROOM_STATE_PATH.read_text(encoding="utf-8"))
            rid = str(st.get("room_id") or "").strip()
            if not rid:
                return
            self._active_state_room_id = rid
            self.total_likes = int(st.get("total_likes") or 0)
            self.total_comments = int(st.get("total_comments") or 0)
            self.total_gifts = int(st.get("total_gifts") or 0)
            raw_users = st.get("joined_users") or []
            if isinstance(raw_users, list):
                now_boot = time.time()
                for u in raw_users[-self.max_halay_seats:]:
                    if isinstance(u, dict) and u.get("uid"):
                        uid = str(u["uid"])
                        u["nickname"] = sanitize_nickname(str(u.get("nickname", "")), fallback_uid=uid, max_len=24)
                        if uid not in self.joined_uids:
                            self.joined_uids.add(uid)
                            self.joined_users.append(u)
                            self.user_likes[uid] = max(self.like_threshold, int(st.get("user_likes", {}).get(uid, self.like_threshold)))
                            self.dancer_until[uid] = now_boot + self.dancer_stamina_sec
                            self.last_active_ts[uid] = now_boot
            raw_queue = st.get("waiting_queue") or []
            if isinstance(raw_queue, list):
                for qu in raw_queue[:60]:
                    if isinstance(qu, dict) and qu.get("uid"):
                        quid = str(qu["uid"])
                        if quid not in self.joined_uids and quid not in self.waiting_uids:
                            qu["nickname"] = sanitize_nickname(str(qu.get("nickname", "")), fallback_uid=quid, max_len=24)
                            self.waiting_uids.add(quid)
                            self.waiting_queue.append(qu)
            if isinstance(st.get("user_likes"), dict):
                for k, v in st["user_likes"].items():
                    self.user_likes[str(k)] = max(self.user_likes.get(str(k), 0), int(v or 0))
            if isinstance(st.get("supporter_points"), dict):
                self.supporter_points = st["supporter_points"]
                for sp_uid, sp in self.supporter_points.items():
                    if isinstance(sp, dict):
                        fb = str(sp.get("uid") or sp_uid or "Misafir")
                        sp["nickname"] = sanitize_nickname(str(sp.get("nickname", "")), fallback_uid=fb, max_len=24)
            if isinstance(st.get("gift_senders"), dict):
                self.gift_senders = st["gift_senders"]
            if isinstance(st.get("gift_totals"), dict):
                self.gift_totals = st["gift_totals"]
            self.halaybasi_user = self._heal_role_dict(st.get("halaybasi_user"), "Halaybaşı")
            self.davulcu_user = self._heal_role_dict(st.get("davulcu_user"), "Davulcu")
            self.zurnaci_user = self._heal_role_dict(st.get("zurnaci_user"), "Zurnacı")
            self.gelin_user = self._heal_role_dict(st.get("gelin_user"), "Gelin")
            self.damat_user = self._heal_role_dict(st.get("damat_user"), "Damat")
            self.halaybasi_gift_until = float(st.get("halaybasi_gift_until") or 0.0)
            if st.get("round_number"):
                self.round_number = max(1, int(st.get("round_number") or 1))
            if st.get("halaybasi_min_diamonds"):
                self.halaybasi_min_diamonds = max(30, int(st.get("halaybasi_min_diamonds") or 30))
            if st.get("bride_min_diamonds"):
                self.bride_min_diamonds = max(199, int(st.get("bride_min_diamonds") or 199))
            if st.get("dominant_country"):
                self.dominant_country = str(st.get("dominant_country") or "tr")
            self.party_meter = max(0, int(st.get("party_meter") or 0))
            if isinstance(st.get("party_patron"), dict):
                self.party_patron = self._heal_role_dict(st.get("party_patron"), "Patron")
            if isinstance(st.get("reigning_champions"), list):
                self.reigning_champions = {str(x) for x in st["reigning_champions"] if x}
            self.bride_gift_until = float(st.get("bride_gift_until") or 0.0)
            if st.get("groom_min_diamonds"):
                self.groom_min_diamonds = max(199, int(st.get("groom_min_diamonds") or 199))
            self.groom_gift_until = float(st.get("groom_gift_until") or 0.0)
            if isinstance(st.get("team_scores"), dict):
                self.team_scores = {
                    "gelin": int(st["team_scores"].get("gelin") or 0),
                    "damat": int(st["team_scores"].get("damat") or 0),
                }
            if isinstance(st.get("city_scores"), dict):
                self.city_scores = st["city_scores"]
            if isinstance(st.get("lang_scores"), dict):
                self.lang_scores = {str(k): int(v or 0) for k, v in st["lang_scores"].items()}
            if isinstance(st.get("country_scores"), dict):
                self.country_scores = {
                    "tr": int(st["country_scores"].get("tr") or 0),
                    "world": int(st["country_scores"].get("world") or 0),
                }
        except Exception as exc:
            logger.warning("Failed restoring active_room_state.json: %s", exc)

    def _save_active_room_state(self) -> None:
        if not self._active_state_room_id:
            return
        try:
            ACTIVE_ROOM_STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
            tmp_path = ACTIVE_ROOM_STATE_PATH.with_suffix(".json.tmp")
            payload = json.dumps({
                "room_id": self._active_state_room_id,
                "username": self.target_username,
                "round_number": self.round_number,
                "total_likes": self.total_likes,
                "total_comments": self.total_comments,
                "total_gifts": self.total_gifts,
                "user_likes": self.user_likes,
                "joined_users": self.joined_users[-self.max_halay_seats:],
                "waiting_queue": self.waiting_queue[:60],
                "halaybasi_user": self.halaybasi_user,
                "davulcu_user": self.davulcu_user,
                "zurnaci_user": self.zurnaci_user,
                "gelin_user": self.gelin_user,
                "damat_user": self.damat_user,
                "halaybasi_gift_until": self.halaybasi_gift_until,
                "halaybasi_min_diamonds": self.halaybasi_min_diamonds,
                "bride_min_diamonds": self.bride_min_diamonds,
                "bride_gift_until": self.bride_gift_until,
                "groom_min_diamonds": self.groom_min_diamonds,
                "groom_gift_until": self.groom_gift_until,
                "team_scores": self.team_scores,
                "city_scores": self.city_scores,
                "lang_scores": self.lang_scores,
                "country_scores": self.country_scores,
                "supporter_points": self.supporter_points,
                "gift_senders": self.gift_senders,
                "gift_totals": self.gift_totals,
                "dominant_country": self.dominant_country,
                "party_meter": self.party_meter,
                "party_patron": self.party_patron,
                "reigning_champions": list(self.reigning_champions),
            }, ensure_ascii=False)
            tmp_path.write_text(payload, encoding="utf-8")
            os.replace(tmp_path, ACTIVE_ROOM_STATE_PATH)
        except Exception:
            pass

    def _score_mult(self) -> int:
        rem = self.round_ends_at - time.time()
        if rem <= 60.0:
            return 3
        if rem <= 120.0:
            return 2
        return 1

    def _dancer_priority_score(self, uid: str) -> float:
        # Likes/chats never push viewers to the front of the halay line; only gifts, VIP roles, and reigning champions do.
        gift_dias = float(self.user_round_diamonds.get(uid, 0))
        penalty = float(getattr(self, "sabotage_penalty", {}).get(uid, 0.0))
        score = max(0.0, gift_dias * 100.0 - penalty)
        if self.halaybasi_user and str(self.halaybasi_user.get("uid")) == uid:
            score += 100000.0
        elif (self.gelin_user and str(self.gelin_user.get("uid")) == uid) or (self.damat_user and str(self.damat_user.get("uid")) == uid):
            score += 50000.0
        elif (self.davulcu_user and str(self.davulcu_user.get("uid")) == uid) or (self.zurnaci_user and str(self.zurnaci_user.get("uid")) == uid):
            score += 30000.0
        elif uid in self.reigning_champions:
            score += 15000.0
        elif uid in self.dancer_vip:
            score += 5000.0
        return score

    def _get_country_war_top(self) -> List[Dict[str, Any]]:
        total = max(1, sum(int(v) for v in self.lang_scores.values() if int(v) > 0))
        items = sorted(
            ((k, int(v)) for k, v in self.lang_scores.items() if int(v) > 0),
            key=lambda kv: -kv[1],
        )[:3]
        return [{"code": k, "score": v, "pct": round(v * 100 / total)} for k, v in items]

    async def _check_country_takeover(self, user: Dict[str, Any]) -> None:
        top = self._get_country_war_top()
        if not top:
            return
        new_dom = top[0]["code"]
        if new_dom and new_dom != self.dominant_country and top[0]["score"] >= 20:
            prev = self.dominant_country
            self.dominant_country = new_dom
            await self.broadcast({
                "type": "country_takeover",
                "country": new_dom,
                "prev_country": prev,
                "user": user,
                "country_war_top": top,
            })

    async def _add_party_energy(self, user: Dict[str, Any], amount: int) -> None:
        if amount <= 0:
            return
        self.party_meter += int(amount)
        if self.party_meter >= self.party_goal:
            self.party_meter = 0
            self.party_patron = {"uid": user.get("uid", ""), "nickname": user.get("nickname", "Patron"), "avatar": user.get("avatar", "")}
            self.party_active_until = time.time() + 45.0
            await self.broadcast({
                "type": "mega_party_burst",
                "patron": self.party_patron,
                "duration": 45,
                "party_meter": 0,
                "party_goal": self.party_goal,
                "party_pct": 0,
            })

    def get_stage_order(self) -> List[str]:
        ordered = sorted(
            self.joined_users,
            key=lambda u: -self._dancer_priority_score(str(u.get("uid", ""))),
        )
        return [str(u["uid"]) for u in ordered if u.get("uid")]

    def _touch_dancer_stamina(self, uid: str, boost_sec: float, cap_sec: float = 180.0) -> None:
        now_ts = time.time()
        self.last_active_ts[uid] = now_ts
        if uid in self.joined_uids:
            cur = max(self.dancer_until.get(uid, now_ts), now_ts)
            self.dancer_until[uid] = min(now_ts + cap_sec, cur + boost_sec)

    def get_round_state(self) -> Dict[str, Any]:
        now_ts = time.time()
        rem = max(0, int(self.round_ends_at - now_ts))
        throne_min = self.halaybasi_min_diamonds if now_ts < self.halaybasi_gift_until else 30
        bride_min = self.bride_min_diamonds if now_ts < self.bride_gift_until else 199
        groom_min = self.groom_min_diamonds if now_ts < self.groom_gift_until else 199
        return {
            "round_number": self.round_number,
            "round_rem_sec": rem,
            "happy_hour_2x": rem <= 120,
            "final_clutch_3x": rem <= 60,
            "score_mult": self._score_mult(),
            "dominant_country": self.dominant_country,
            "country_war_top": self._get_country_war_top(),
            "party_meter": self.party_meter,
            "party_goal": self.party_goal,
            "party_pct": min(100, int(self.party_meter * 100 / max(1, self.party_goal))),
            "party_patron": self.party_patron,
            "party_active": now_ts < self.party_active_until,
            "reigning_champions": list(self.reigning_champions),
            "throne_min": throne_min,
            "bride_min": bride_min,
            "groom_min": groom_min,
            "max_seats": self.max_halay_seats,
            "seat_count": len(self.joined_users),
            "queue_count": len(self.waiting_queue),
            "queue_next": (
                {"uid": self.waiting_queue[0].get("uid", ""), "nickname": self.waiting_queue[0].get("nickname", "Misafir")}
                if self.waiting_queue
                else None
            ),
            "stamina_sec": int(self.dancer_stamina_sec),
            "stage_order": self.get_stage_order(),
        }

    async def check_and_advance_round(self) -> Optional[Dict[str, Any]]:
        now_ts = time.time()
        if now_ts < self.round_ends_at:
            return None
        finished_round = self.round_number
        top_lb = self.get_leaderboard(1)
        winner = None
        if top_lb:
            winner = {"uid": top_lb[0]["uid"], "nickname": top_lb[0]["nickname"], "avatar": top_lb[0].get("avatar", "")}
        elif self.halaybasi_user:
            winner = dict(self.halaybasi_user)
        else:
            winner = {"uid": "meydan", "nickname": "Meydan Şampiyonu", "avatar": ""}
        self.reigning_champions = {
            str(r["uid"])
            for r in (self.halaybasi_user, self.gelin_user, self.damat_user, winner)
            if isinstance(r, dict) and r.get("uid") and str(r.get("uid")) != "meydan"
        }
        g_score = int(self.team_scores.get("gelin", 0))
        d_score = int(self.team_scores.get("damat", 0))
        win_team = "gelin" if g_score > d_score else ("damat" if d_score > g_score else "berabere")
        prof_w: Optional[Dict[str, Any]] = None
        try:
            self.viewer_store.record_round_history(finished_round, win_team, g_score, d_score)
            if isinstance(winner, dict) and winner.get("uid") and str(winner["uid"]) != "meydan":
                self.viewer_store.record_round_win(str(winner["uid"]))
                prof_w = self.viewer_store.get_profile(str(winner["uid"]))
        except Exception:
            pass
        if isinstance(winner, dict) and isinstance(prof_w, dict):
            winner = {
                **winner,
                "level": int(prof_w.get("level") or 1),
                "xp": int(prof_w.get("xp") or 0),
                "title": str(prof_w.get("title") or ""),
                "streak_days": int(prof_w.get("streak_days") or 1),
                "round_wins": int(prof_w.get("round_wins") or 0),
            }
        self.round_number += 1
        self.round_ends_at = now_ts + float(self.round_duration_sec)
        self.user_round_diamonds.clear()
        self.team_scores = {"gelin": 0, "damat": 0}
        self.city_scores.clear()
        self.country_scores = {"tr": 0, "world": 0}
        payload = {
            "type": "round_winner",
            "round_finished": finished_round,
            "winner": winner,
            "winning_team": win_team,
            "winner_scores": {"gelin": g_score, "damat": d_score},
            **self.get_round_state(),
        }
        await self.broadcast(payload)
        # Rotate full venue + weather package across rounds
        venues = (
            {"atmosphere": "day", "weather": "auto", "floor": "altigen", "figure": "ana"},
            {"atmosphere": "sunset", "weather": "auto", "floor": "kum", "figure": "kol"},
            {"atmosphere": "night", "weather": "auto", "floor": "seramik", "figure": "one"},
            {"atmosphere": "snow", "weather": "auto", "floor": "seramik", "figure": "cokme"},
            {"atmosphere": "rain", "weather": "auto", "floor": "toprak", "figure": "ana"},
        )
        next_venue = venues[self.round_number % len(venues)]
        await self.broadcast({"type": "director_control", **next_venue})
        if self.ai_role_hook is not None:
            lang = self.user_langs.get(str(winner.get("uid", "")), "tr")
            streak_d, wins_c = 1, 0
            try:
                if winner.get("uid") and str(winner["uid"]) != "meydan":
                    prof = self.viewer_store.get_profile(str(winner["uid"]))
                    if prof:
                        streak_d = int(prof.get("streak_days") or 1)
                        wins_c = int(prof.get("round_wins") or 0)
            except Exception:
                pass
            asyncio.create_task(self.ai_role_hook(winner, "round_winner", f"{finished_round}. Düğün|{streak_d}|{wins_c}", 0, lang))
        self._save_active_room_state()
        return payload

    def _record_viewer_lang(self, uid: str, lang: str, pts: int) -> tuple[str, str]:
        resolved = lang if lang in LANG_META else self.user_langs.get(uid, "tr")
        if resolved not in LANG_META:
            resolved = "tr"
        if uid:
            self.user_langs[uid] = resolved
        inc = max(1, int(pts or 1)) * self._score_mult()
        self.lang_scores[resolved] = self.lang_scores.get(resolved, 0) + inc
        bucket = "tr" if resolved == "tr" else "world"
        self.country_scores[bucket] = self.country_scores.get(bucket, 0) + inc
        return resolved, LANG_META[resolved]["flag"]

    def add_city_points(self, plate: str, city_name: str, pts: int) -> None:
        entry = self.city_scores.get(plate)
        if not entry:
            entry = {"plate": plate, "city": city_name, "score": 0}
            self.city_scores[plate] = entry
        entry["score"] += int(pts) * self._score_mult()

    def get_city_leaderboard(self, top_n: int = 4) -> List[Dict[str, Any]]:
        ranked = sorted(self.city_scores.values(), key=lambda x: x["score"], reverse=True)[:top_n]
        return [{"plate": r["plate"], "city": r["city"], "score": int(r["score"])} for r in ranked if r["score"] >= 1]

    async def bump_combo(self, weight: int = 1) -> int:
        now = time.monotonic()
        if now - self.last_combo_ts > 6.5:
            self.combo_count = weight
        else:
            self.combo_count += weight
        self.last_combo_ts = now
        if self.combo_count >= 15 and self.combo_count % 15 < weight:
            await self.broadcast({"type": "fever_burst", "combo": self.combo_count})
        return self.combo_count

    def get_user_rank_summary(self, uid: str) -> str:
        ranked = sorted(self.supporter_points.values(), key=lambda x: x["score"], reverse=True)
        for idx, item in enumerate(ranked, start=1):
            if item["uid"] == uid:
                return f"🏆 #{idx}. Sıra • {int(round(item['score']))} Puan"
        return "🏆 Yeni Halaycı • 5 Puan"

    def add_supporter_points(self, user: Dict[str, Any], pts: float) -> None:
        uid = user.get("uid", "")
        if not uid:
            return
        entry = self.supporter_points.get(uid)
        if not entry:
            entry = {"uid": uid, "nickname": user.get("nickname", "Misafir"), "avatar": user.get("avatar", ""), "score": 0.0}
            self.supporter_points[uid] = entry
        entry["score"] += float(pts) * self._score_mult()
        if user.get("avatar"):
            entry["avatar"] = user["avatar"]

    def get_leaderboard(self, top_n: int = 5) -> List[Dict[str, Any]]:
        ranked = sorted(self.supporter_points.values(), key=lambda x: x["score"], reverse=True)[:top_n]
        return [
            {"uid": r["uid"], "nickname": r["nickname"], "avatar": r["avatar"], "score": int(round(r["score"]))}
            for r in ranked if r["score"] >= 1
        ]

    def record_gift_stats(
        self,
        user: Dict[str, Any],
        gift_id: int,
        gift_name: str,
        gift_image: str,
        repeat_count: int,
        diamonds: int,
    ) -> None:
        uid = str(user.get("uid") or "").strip()
        if not uid:
            return
        cnt = max(1, int(repeat_count or 1))
        val = max(1, int(diamonds or 1))
        gkey = str(gift_id if gift_id else gift_name.lower().strip() or "gift")
        pair_key = f"{uid}:{gkey}"

        entry = self.gift_senders.get(pair_key)
        if not entry:
            entry = {
                "uid": uid,
                "nickname": user.get("nickname", uid),
                "avatar": user.get("avatar", ""),
                "gift_id": int(gift_id or 0),
                "gift_name": gift_name,
                "gift_image": gift_image,
                "count": 0,
                "diamonds": 0,
            }
            self.gift_senders[pair_key] = entry
        entry["nickname"] = user.get("nickname") or entry["nickname"]
        if user.get("avatar"):
            entry["avatar"] = user["avatar"]
        if gift_image:
            entry["gift_image"] = gift_image
        entry["count"] = int(entry.get("count", 0)) + cnt
        entry["diamonds"] = int(entry.get("diamonds", 0)) + val

        gtot = self.gift_totals.get(gkey)
        if not gtot:
            gtot = {
                "gift_id": int(gift_id or 0),
                "gift_name": gift_name,
                "gift_image": gift_image,
                "count": 0,
                "diamonds": 0,
                "top_uid": uid,
                "top_nickname": user.get("nickname", uid),
                "top_avatar": user.get("avatar", ""),
                "top_count": 0,
            }
            self.gift_totals[gkey] = gtot
        if gift_image:
            gtot["gift_image"] = gift_image
        gtot["count"] = int(gtot.get("count", 0)) + cnt
        gtot["diamonds"] = int(gtot.get("diamonds", 0)) + val
        if entry["count"] >= int(gtot.get("top_count", 0)):
            gtot["top_uid"] = uid
            gtot["top_nickname"] = entry["nickname"]
            gtot["top_avatar"] = entry["avatar"]
            gtot["top_count"] = entry["count"]

    def get_gift_leaderboard(self, top_n: int = 6) -> List[Dict[str, Any]]:
        ranked = sorted(
            self.gift_senders.values(),
            key=lambda x: (int(x.get("count", 0)), int(x.get("diamonds", 0))),
            reverse=True,
        )
        unique_first: List[Dict[str, Any]] = []
        overflow: List[Dict[str, Any]] = []
        seen_uids: set[str] = set()
        for item in ranked:
            u = str(item.get("uid") or "")
            if u and u not in seen_uids:
                seen_uids.add(u)
                unique_first.append(item)
            else:
                overflow.append(item)
        return (unique_first + overflow)[:top_n]

    def get_top_rewards(self, top_n: int = 4) -> List[Dict[str, Any]]:
        ranked = sorted(
            self.gift_totals.values(),
            key=lambda x: (int(x.get("count", 0)), int(x.get("diamonds", 0))),
            reverse=True,
        )
        return ranked[:top_n]

    def _load_config(self) -> None:
        if CONFIG_PATH.exists():
            try:
                cfg = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
                self.target_username = str(cfg.get("tiktok_username", "")).strip().lstrip("@")
                self.tiktok_session_id = str(cfg.get("tiktok_session_id", "")).strip()
                econ_ver = int(cfg.get("economy_version", 1) or 1)
                if econ_ver < 3:
                    self.like_threshold = max(1, int(cfg.get("like_threshold", 100)))
                    self.tier2_min = max(2, int(cfg.get("tier2_min", 20)))
                    self.tier3_min = max(5, int(cfg.get("tier3_min", 30)))
                    self.gift_join_only = True
                    self.join_min_diamonds = 20
                    self.join_on_keyword = False
                    self.economy_version = 3
                else:
                    self.like_threshold = max(1, int(cfg.get("like_threshold", 100)))
                    self.tier2_min = max(2, int(cfg.get("tier2_min", 20)))
                    self.tier3_min = max(5, int(cfg.get("tier3_min", 30)))
                    self.gift_join_only = bool(cfg.get("gift_join_only", True))
                    self.join_min_diamonds = max(1, int(cfg.get("join_min_diamonds", 20)))
                    self.join_on_keyword = False if self.gift_join_only else bool(cfg.get("join_on_keyword", False))
                    self.economy_version = econ_ver
                self.scene_mode = str(cfg.get("scene_mode", "kirdgunu_ring"))
                self.avatar_style = str(cfg.get("avatar_style", "roach"))
                self.music_preset = str(cfg.get("music_preset", "halay"))
                self.tts_enabled = bool(cfg.get("tts_enabled", True))
                self.join_on_any_chat = False if self.gift_join_only else bool(cfg.get("join_on_any_chat", False))
                self.join_on_follow = False if self.gift_join_only else bool(cfg.get("join_on_follow", False))
                self.join_on_enter = False
                if econ_ver < 3:
                    self.save_config()
            except Exception as exc:
                logger.warning("Failed to load config.json: %s", exc)

    def save_config(self) -> None:
        try:
            CONFIG_PATH.write_text(
                json.dumps({
                    "tiktok_username": self.target_username,
                    "tiktok_session_id": self.tiktok_session_id,
                    "economy_version": self.economy_version,
                    "like_threshold": self.like_threshold,
                    "tier2_min": self.tier2_min,
                    "tier3_min": self.tier3_min,
                    "gift_join_only": self.gift_join_only,
                    "join_min_diamonds": self.join_min_diamonds,
                    "scene_mode": self.scene_mode,
                    "avatar_style": self.avatar_style,
                    "music_preset": self.music_preset,
                    "tts_enabled": self.tts_enabled,
                    "join_on_keyword": self.join_on_keyword,
                    "join_on_any_chat": self.join_on_any_chat,
                    "join_on_follow": self.join_on_follow,
                    "join_on_enter": self.join_on_enter,
                }, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
        except Exception as exc:
            logger.warning("Failed to persist config.json: %s", exc)

    async def boot(self) -> None:
        self.event_engine.start()
        self.event_scheduler.start()
        if self.target_username:
            await self.connect_tiktok(self.target_username, self.tiktok_session_id)

    async def shutdown(self) -> None:
        await self.disconnect_tiktok(clear_target=False)
        await self.event_scheduler.stop()
        await self.event_engine.stop()
        self.viewer_store.close()

    async def connect_tiktok(self, username: str, session_id: str = "") -> Dict[str, Any]:
        clean = username.strip().lstrip("@")
        if not clean:
            return {"ok": False, "error": "Lütfen geçerli bir TikTok @kullanıcı_adı girin."}

        new_sid = session_id.strip()
        if (
            self.is_watching
            and self.target_username.lower() == clean.lower()
            and (not new_sid or new_sid == self.tiktok_session_id)
            and self.supervisor_task is not None
            and not self.supervisor_task.done()
        ):
            await self._emit_status()
            return {"ok": True, "username": self.target_username, "reused": True}

        await self.disconnect_tiktok(clear_target=False)
        self.target_username = clean
        if new_sid:
            self.tiktok_session_id = new_sid
        self.is_watching = True
        self.save_config()

        self.supervisor_task = asyncio.create_task(self._live_supervisor_loop(clean))
        await self._emit_status(f"@{clean} canlı yayını kontrol ediliyor...")
        return {"ok": True, "username": clean}

    async def disconnect_tiktok(self, clear_target: bool = True) -> None:
        self.is_watching = False
        if clear_target:
            self.target_username = ""
            self.save_config()
        if self.supervisor_task and not self.supervisor_task.done():
            self.supervisor_task.cancel()
        if getattr(self, "_stats_poller_task", None) and not self._stats_poller_task.done():
            self._stats_poller_task.cancel()
        self._stats_poller_task = None
        if self.client is not None:
            old_client = self.client
            self.client = None
            try:
                if getattr(old_client, "_event_loop_task", None):
                    old_client._event_loop_task.cancel()
                await old_client._ws.disconnect()
            except BaseException:
                pass
        self.is_live_connected = False
        self.connected_room_id = ""
        self.viewer_count = 0
        await self._emit_status("Canlı yayın bağlantısı durduruldu.")

    async def _resolve_live_room(self, username: str) -> tuple[bool, Optional[int]]:
        """Resolves (is_live, room_id) directly via curl_cffi JSON without consuming sign-server quota."""
        try:
            async with AsyncSession(impersonate="chrome124", timeout=5) as s:
                r = await s.get(
                    f"https://www.tiktok.com/api-live/user/room/?aid=1988&sourceType=54&uniqueId={username}",
                    headers={"Accept": "application/json", "Referer": "https://www.tiktok.com/"},
                )
                if r.status_code == 200 and r.text.strip():
                    data = (r.json() or {}).get("data") or {}
                    user_d = data.get("user") or {}
                    room_d = data.get("liveRoom") or {}
                    stats_d = room_d.get("liveRoomStats") or {}
                    live_uc = int(stats_d.get("userCount") or 0)
                    room_st = room_d.get("status")
                    user_st = user_d.get("status")
                    st = room_st if room_st is not None else user_st
                    rid_str = str(room_d.get("roomId") or user_d.get("roomId") or "").strip()
                    rid = int(rid_str) if rid_str.isdigit() else None
                    if rid and st in (2, 3):
                        if live_uc > 0:
                            self.viewer_count = live_uc
                        return True, rid
                    if st == 4 or not rid:
                        self.viewer_count = 0
                        return False, None
                    chk = await s.get(
                        f"https://webcast.tiktok.com/webcast/room/check_alive/?aid=1988&room_ids={rid}",
                        headers={"Accept": "application/json", "Referer": "https://www.tiktok.com/"},
                    )
                    if chk.status_code == 200:
                        alive_list = (chk.json() or {}).get("data") or []
                        if alive_list and alive_list[0].get("alive") is True:
                            return True, rid
        except Exception as exc:
            logger.debug("Live room resolve warning for @%s: %s", username, exc)
        return False, None

    async def _get_sign_proxies(self) -> List[str]:
        """Returns verified sign-only HTTP proxies when primary IP hits EulerStream hourly rate limit."""
        seed = [
            "http://4.144.146.21:80",
            "http://180.53.81.127:8080",
            "http://140.238.32.108:3128",
            "http://8.211.49.86:10000",
            "http://8.211.42.167:3129",
            "http://8.213.134.213:55443",
            "http://192.166.82.12:10888",
        ]
        try:
            async with AsyncSession(impersonate="chrome124", timeout=4) as s:
                r = await s.get(
                    "https://api.proxyscrape.com/v2/?request=displayproxies&protocol=http&timeout=2500&country=all&ssl=all&anonymity=elite"
                )
                if r.status_code == 200:
                    for line in r.text.splitlines()[:18]:
                        ip_p = line.strip()
                        if ":" in ip_p:
                            u = f"http://{ip_p}"
                            if u not in seed:
                                seed.append(u)
        except Exception:
            pass
        return seed

    async def _live_supervisor_loop(self, username: str) -> None:
        sign_proxies: List[Optional[str]] = [None]
        proxy_idx = 0
        retry_delay = 1.0

        while self.is_watching and self.target_username == username:
            try:
                live_now, room_id = await self._resolve_live_room(username)
                if not live_now:
                    self.is_live_connected = False
                    await self._emit_status(
                        f"⏳ @{username} şu an yayında değil — yayın açıldığı saniye otomatik bağlanacak..."
                    )
                    await asyncio.sleep(15.0 + random.uniform(1.0, 4.0))
                    continue

                probe = TikTokLiveClient(unique_id=f"@{username}")
                if self.tiktok_session_id and hasattr(probe, "web"):
                    try:
                        if hasattr(probe.web, "set_session"):
                            probe.web.set_session(self.tiktok_session_id)
                        elif hasattr(probe.web, "cookies"):
                            probe.web.cookies.set("sessionid", self.tiktok_session_id, domain=".tiktok.com")
                    except Exception:
                        pass

                px = sign_proxies[proxy_idx % len(sign_proxies)]
                if px:
                    signer = probe._web.signer
                    signer.sdk_client.set_async_httpx_client(
                        httpx.AsyncClient(
                            base_url=signer._base_url,
                            headers={"User-Agent": "TikTokLive.py/7.0.1"},
                            verify=False,
                            proxy=px,
                            timeout=7.5,
                        )
                    )

                self.client = probe
                self._bind_client_events(probe, username)
                await self._emit_status(f"🔌 @{username} canlı yayını bulundu (Oda: {room_id}), bağlanıyor...")
                retry_delay = 1.0
                ws_task = await probe.start(room_id=room_id, fetch_live_check=False)
                await ws_task
                if self.is_watching and self.target_username == username:
                    self.is_live_connected = False
                    await asyncio.sleep(2.0)
            except asyncio.CancelledError:
                break
            except Exception as exc:
                self.is_live_connected = False
                err_txt = str(exc)
                if "UserOffline" in exc.__class__.__name__ or "offline" in err_txt.lower():
                    await self._emit_status(f"⏳ @{username} şu an yayında değil — yayın açılınca otomatik bağlanacak...")
                    await asyncio.sleep(5.0)
                elif any(k in err_txt or k in exc.__class__.__name__ for k in ("RATE_LIMIT", "Timeout", "ConnectError", "ProxyError", "SignAPIError")):
                    if len(sign_proxies) == 1:
                        await self._emit_status("🔄 İmza sunucusu yedek proxy havuzuna geçiriliyor...")
                        extra = await self._get_sign_proxies()
                        sign_proxies.extend(extra)
                    proxy_idx += 1
                    backoff = min(12.0, retry_delay)
                    retry_delay = min(16.0, retry_delay * 1.5)
                    await asyncio.sleep(backoff)
                else:
                    await self._emit_status(f"🔄 @{username} yeniden bağlanıyor ({err_txt[:80]})...")
                    backoff = min(8.0, retry_delay)
                    retry_delay = min(12.0, retry_delay * 1.4)
                    await asyncio.sleep(backoff)

    def _bind_client_events(self, client: TikTokLiveClient, username: str) -> None:
        @client.on(ConnectEvent)
        async def on_connect(ev: ConnectEvent) -> None:
            new_rid = str(getattr(ev, "room_id", "") or "").strip()
            gap_sec = (time.time() - self._last_disconnect_ts) if self._last_disconnect_ts > 0 else 0.0
            same_room = bool(new_rid and self._active_state_room_id and new_rid == self._active_state_room_id)
            is_new_stream = bool(
                (new_rid and new_rid != self._active_state_room_id)
                or (not self._active_state_room_id and (self.joined_uids or self.joined_users))
                or (not same_room and gap_sec > 25.0)
            )
            if is_new_stream:
                logger.info("Yeni canlı yayın algılandı (room=%s, prev=%s, gap=%.1fs); halay sıfırlanıyor.", new_rid, self._active_state_room_id, gap_sec)
                await self.reset_state()
            self._last_disconnect_ts = 0.0
            self.is_live_connected = True
            self.connected_room_id = new_rid
            if new_rid:
                self._active_state_room_id = new_rid
                self._save_active_room_state()
            await self._emit_status(f"🔴 CANLI BAĞLANDI: @{username} (Oda: {self.connected_room_id})")
            if self._stats_poller_task and not self._stats_poller_task.done():
                self._stats_poller_task.cancel()
            self._stats_poller_task = asyncio.create_task(self._live_room_stats_poller(username))

        @client.on(DisconnectEvent)
        async def on_disconnect(_: DisconnectEvent) -> None:
            self.is_live_connected = False
            self._last_disconnect_ts = time.time()
            pending = getattr(self, "_pending_streaks", {})
            if pending:
                for skey, sdata in list(pending.items()):
                    pending.pop(skey, None)
                    try:
                        await self.process_gift(
                            sdata["user"], sdata["gname"], sdata["total_dia"],
                            gift_id=sdata["gid"], diamond_unit=sdata["du"],
                            repeat_count=sdata["repeat"], gift_image=sdata["img"],
                        )
                    except Exception:
                        pass
            await self._emit_status(f"@{username} yayın akışı kesildi, yeniden kontrol ediliyor...")

        @client.on(RoomUserSeqEvent)
        async def on_viewers(ev: RoomUserSeqEvent) -> None:
            self.viewer_count = int(getattr(ev, "m_total", 0) or getattr(ev, "total", 0) or 0)
            now_r = time.time()
            for bucket in (getattr(ev, "ranks", None), getattr(ev, "seats", None)):
                if not bucket:
                    continue
                for contrib in bucket:
                    u_obj = getattr(contrib, "user", None)
                    r_uid = str(getattr(u_obj, "id", "") or getattr(u_obj, "user_id", "") or "").strip() if u_obj is not None else ""
                    if r_uid:
                        self._seen_in_ranks.add(r_uid)
                        self._last_ranks_seen[r_uid] = now_r
            await self._emit_status()

        @client.on(JoinEvent)
        async def on_join(ev: JoinEvent) -> None:
            u = extract_user_payload(getattr(ev, "user", None))
            self.total_entries += 1
            if self.viewer_count == 0:
                self.viewer_count = 1
            uid = u["uid"]
            self.last_active_ts[uid] = time.time()
            await self.broadcast({
                "type": "live_feed",
                "kind": "enter",
                "user": u,
                "detail": "yayına girdi",
                "joined": uid in self.joined_uids,
                "user_likes": self.user_likes.get(uid, 0),
                "like_threshold": self.like_threshold,
                "viewer_count": self.viewer_count,
                "total_likes": self.total_likes,
                "total_comments": self.total_comments,
                "total_gifts": self.total_gifts,
            })

        @client.on(LikeEvent)
        async def on_like(ev: LikeEvent) -> None:
            u = extract_user_payload(getattr(ev, "user", None))
            cnt = max(1, int(getattr(ev, "count", 1) or 1))
            stream_total = int(getattr(ev, "total", 0) or getattr(ev, "total_likes", 0) or 0)
            self.event_engine.submit_like(
                u["uid"],
                u,
                cnt,
                stream_total,
                lambda usr, total_cnt, st_tot: self.process_like(usr, total_cnt, stream_total=st_tot),
            )

        @client.on(CommentEvent)
        async def on_comment(ev: CommentEvent) -> None:
            u = extract_user_payload(getattr(ev, "user", None))
            txt = str(getattr(ev, "comment", None) or getattr(ev, "content", "") or "").strip()
            if txt:
                msg_id = str(getattr(ev, "msg_id", "") or getattr(getattr(ev, "base_message", None), "message_id", "") or "")
                dedup = f"chat:{msg_id}" if msg_id else ""
                await self.event_engine.submit(
                    EventPriority.CHAT,
                    "chat",
                    lambda usr=u, msg=txt: self.process_chat(usr, msg),
                    dedup_key=dedup,
                )

        @client.on(GiftEvent)
        async def on_gift(ev: GiftEvent) -> None:
            gift_obj = getattr(ev, "gift", None)
            u = extract_user_payload(getattr(ev, "user", None))
            gid = int(getattr(gift_obj, "id", 0) or getattr(ev, "gift_id", 0) or 0)
            gname = str(getattr(gift_obj, "name", "Hediye") if gift_obj else "Hediye")
            diamonds = int(getattr(gift_obj, "diamond_count", 1) if gift_obj else 1)
            repeat = max(1, int(getattr(ev, "repeat_count", 1) or 1))
            gift_img = ""
            if gift_obj is not None:
                for attr_name in ("icon", "image"):
                    img_obj = getattr(gift_obj, attr_name, None)
                    if img_obj is not None:
                        urls = getattr(img_obj, "url_list", None) or getattr(img_obj, "urls", None) or []
                        if urls and isinstance(urls[0], str) and urls[0].startswith("http"):
                            gift_img = urls[0]
                            break
            total_dia = diamonds * repeat
            if not hasattr(self, "_pending_streaks"):
                self._pending_streaks = {}
            skey = (u.get("uid", ""), gid)
            if bool(getattr(ev, "streaking", False)):
                self._pending_streaks[skey] = {
                    "user": u, "gname": gname, "total_dia": total_dia,
                    "gid": gid, "du": diamonds, "repeat": repeat, "img": gift_img,
                }
                return
            self._pending_streaks.pop(skey, None)
            prio = (
                EventPriority.BIG_GIFT
                if total_dia >= 100
                else (EventPriority.SPECIAL_GIFT if total_dia >= 20 else EventPriority.NORMAL_GIFT)
            )
            msg_id = str(getattr(ev, "msg_id", "") or getattr(getattr(ev, "base_message", None), "message_id", "") or "")
            dedup = f"gift:{msg_id}:{gid}:{repeat}" if msg_id else ""
            await self.event_engine.submit(
                prio,
                "gift",
                lambda usr=u, gn=gname, td=total_dia, gi=gid, du=diamonds, rp=repeat, img=gift_img: self.process_gift(
                    usr, gn, td, gift_id=gi, diamond_unit=du, repeat_count=rp, gift_image=img
                ),
                dedup_key=dedup,
            )

        @client.on(FollowEvent)
        async def on_follow(ev: FollowEvent) -> None:
            u = extract_user_payload(getattr(ev, "user", None))
            async def _run_follow(usr: Dict[str, str] = u) -> None:
                await self.broadcast({"type": "live_feed", "kind": "follow", "user": usr, "detail": "takip etti! ➕"})
                if not self.gift_join_only and self.join_on_follow:
                    await self.queue_join(usr, reason="takip")
            await self.event_engine.submit(
                EventPriority.FOLLOW,
                "follow",
                _run_follow,
                dedup_key=f"follow:{u['uid']}",
            )

        @client.on(ShareEvent)
        async def on_share(ev: ShareEvent) -> None:
            u = extract_user_payload(getattr(ev, "user", None))
            self.add_supporter_points(u, 5.0)
            await self.broadcast({"type": "live_feed", "kind": "share", "user": u, "detail": "yayını paylaştı! 🔄"})

    async def process_like(self, user: Dict[str, str], count: int, stream_total: int = 0) -> None:
        uid = user["uid"]
        total = self.user_likes.get(uid, 0) + count
        self.user_likes[uid] = total
        self.total_likes = max(self.total_likes + count, stream_total)
        self.add_supporter_points(user, count * 0.25)
        try:
            self.viewer_store.record_activity(uid, user.get("nickname", uid), xp_delta=max(1, count // 2), likes_delta=count)
        except Exception:
            pass

        if uid in self.user_cities:
            plate, cname = self.user_cities[uid]
            self.add_city_points(plate, cname, max(1, count // 10))

        if uid in self.user_langs:
            l_code, l_flag = self._record_viewer_lang(uid, self.user_langs[uid], max(1, count // 5))
            user["lang"] = l_code
            user["flag"] = l_flag

        team = self.user_teams.get(uid)
        if team:
            self.team_scores[team] = self.team_scores.get(team, 0) + max(1, count // 2)

        # Sayıyla 40-Like Stepwise Tempo Gear Multiplier (yavas -> orta -> hizli -> cosku)
        self.tempo_like_bucket += count
        tempo_gears = ["yavas", "orta", "hizli", "cosku"]
        if self.tempo_like_bucket >= 40:
            steps = self.tempo_like_bucket // 40
            self.tempo_like_bucket %= 40
            cur_idx = tempo_gears.index(self.tempo_gear) if self.tempo_gear in tempo_gears else 1
            self.tempo_gear = tempo_gears[min(len(tempo_gears) - 1, cur_idx + steps)]

        self.global_like_bucket += count
        like_goal_hit = False
        while self.global_like_bucket >= self.likes_for_clap:
            self.global_like_bucket -= self.likes_for_clap
            self.total_claps += 1
            like_goal_hit = True

        was_joined = uid in self.joined_uids
        rem_likes = 0 if was_joined else max(0, self.like_threshold - total)
        await self.broadcast({
            "type": "like",
            "user": user,
            "count": count,
            "user_total": total,
            "already_joined": was_joined,
            "remaining_likes": rem_likes,
            "total_likes": self.total_likes,
            "viewer_count": self.viewer_count,
            "threshold": self.like_threshold,
            "like_bucket": self.global_like_bucket,
            "likes_for_clap": self.likes_for_clap,
            "tempo_gear": self.tempo_gear,
            "team_scores": self.team_scores,
            "country_scores": self.country_scores,
            "lang_scores": self.lang_scores,
            "leaderboard": self.get_leaderboard(),
            "gift_leaderboard": self.get_gift_leaderboard(),
            "top_rewards": self.get_top_rewards(),
            "city_leaderboard": self.get_city_leaderboard(),
            **self.get_round_state(),
        })
        if like_goal_hit:
            await self.broadcast({
                "type": "like_goal",
                "total_claps": self.total_claps,
                "tempo_gear": self.tempo_gear,
                "leaderboard": self.get_leaderboard(),
                "city_leaderboard": self.get_city_leaderboard(),
                **self.get_round_state(),
            })

        now = time.monotonic()
        cum_dia = self.user_round_diamonds.get(uid, 0)
        if now - self._last_minor_feed_ts >= 0.35 or (not self.gift_join_only and total >= self.like_threshold):
            self._last_minor_feed_ts = now
            if self.gift_join_only and not was_joined:
                detail_msg = f"+{count} ⚡ ({total} beğeni — Takım/Şehir Puanı)"
            else:
                detail_msg = (
                    f"{total}/{self.like_threshold}⚡ — halaya {rem_likes} enerji kaldı"
                    if (not was_joined and rem_likes > 0)
                    else f"+{count} ⚡ ({total})"
                )
            await self.broadcast({
                "type": "live_feed",
                "kind": "like",
                "user": user,
                "detail": detail_msg,
            })
        if was_joined or (not self.gift_join_only and total >= self.like_threshold):
            self._touch_dancer_stamina(uid, 35.0, cap_sec=180.0)
        if not was_joined and not self.gift_join_only and total >= self.like_threshold:
            await self.queue_join(user, reason="begeni", flush_now=True)
        if count >= 10:
            await self._add_party_energy(user, 1)
        await self._check_country_takeover(user)
        await self.check_and_advance_round()

    async def process_chat(self, user: Dict[str, str], text: str) -> None:
        uid = user["uid"]
        safe_for_bubble = is_safe_speech_bubble(text)
        clean_text = sanitize_turkish_text(text, max_len=90)
        low = clean_text.lower().strip()
        norm_cmd = low.replace("\u0307", "").strip()
        self.total_comments += 1
        self.add_supporter_points(user, 3.0)
        combo = await self.bump_combo(1)

        if clean_text.isdigit():
            raw_lang = self.user_langs.get(uid, "tr")
        else:
            raw_lang = detect_message_language(clean_text)
        lang_code, lang_flag = self._record_viewer_lang(uid, raw_lang, 4)
        user["lang"] = lang_code
        user["flag"] = lang_flag

        _costume_girl = {
            "1", "kiz", "kız", "kadin", "kadın", "stil 1", "kostum 1", "kostüm 1", "hanim", "hanım",
            "girl", "woman", "female", "девушка", "девочка", "женщина", "fille", "frau", "chica", "qiz",
        }
        _costume_boy = {
            "2", "erkek", "efe", "stil 2", "kostum 2", "kostüm 2",
            "boy", "man", "male", "парень", "мальчик", "мужчина", "garcon", "garçon", "mann", "chico", "oglan",
        }
        costume_gender = "kadin" if norm_cmd in _costume_girl else ("erkek" if norm_cmd in _costume_boy else "")
        if costume_gender:
            user["gender"] = costume_gender
            for item in self.joined_users:
                if item.get("uid") == uid:
                    item["gender"] = costume_gender

        # 3-Second Per-User Command Cooldown (Anti-Spam Shield per sayiyla.com guide)
        now_mono = time.monotonic()
        last_cmd_ts = self.user_cmd_cooldowns.get(uid, 0.0)
        can_trigger_cmd = (now_mono - last_cmd_ts) >= 3.0
        if can_trigger_cmd or costume_gender:
            self.user_cmd_cooldowns[uid] = now_mono

        # Multilingual VIP DJ Request (!istek [song], !трек [песня], !song [title], !أغنية, !mahni, !cancion, !lied, !chanson)
        dj_match = re.match(
            r"^(?:[!/](?:istek|çal|cal|şarkı|sarki|parça|parca|müzik|muzik|song|play|music|dj|track|песня|трек|музыка|أغنية|اغنية|cancion|canción|música|lied|musik|chanson|musique|mahnı|mahni)(?:\s+(.*))?|(?:istek|şarkı|sarki|песня|трек|أغنية|اغنية|mahni|mahnı)\s+(.+))$",
            low,
        )
        if can_trigger_cmd and dj_match and self.jukebox_request_fn is not None:
            q_str = (dj_match.group(1) or dj_match.group(2) or "").strip()[:55]
            user_score = float((self.supporter_points.get(uid) or {}).get("score", 0.0))
            is_vip_dj = (
                self.open_multilang_dj
                or (uid in self.dancer_vip)
                or any(isinstance(r, dict) and r.get("uid") == uid for r in self.get_vip_roles().values())
            )
            if is_vip_dj:
                sig = inspect.signature(self.jukebox_request_fn)
                if "lang" in sig.parameters or any(
                    p.kind == inspect.Parameter.VAR_KEYWORD for p in sig.parameters.values()
                ):
                    matched = await self.jukebox_request_fn(
                        q_str,
                        user["nickname"],
                        True if (lang_code != "tr" or user_score >= 300.0 or is_vip_dj) else False,
                        lang=lang_code,
                        flag=lang_flag,
                    )
                else:
                    matched = await self.jukebox_request_fn(q_str, user["nickname"], user_score >= 300.0)
                if isinstance(matched, dict) and self.ai_role_hook is not None:
                    tr_title = (
                        (matched.get("current") or {}).get("title")
                        or matched.get("title")
                        or q_str
                        or "DJ Mix"
                    )
                    asyncio.create_task(self.ai_role_hook(user, "dj_play", str(tr_title)[:50], 0, lang_code))
            else:
                await self.broadcast({
                    "type": "dj_locked",
                    "user": user,
                    "lang": lang_code,
                    "query": q_str,
                })
                if self.ai_role_hook is not None and (now_mono - self._last_dj_lock_notice_ts) >= 12.0:
                    self._last_dj_lock_notice_ts = now_mono
                    asyncio.create_task(self.ai_role_hook(user, "dj_lock", "Parfüm", 0, lang_code))

        # 81-Province Memleket / Şehir Savaşı Detection (City War + Automatic Join!)
        matched_city = match_turkish_city(clean_text)
        city_badge = ""
        if matched_city:
            plate, city_name = matched_city
            self.user_cities[uid] = (plate, city_name)
            user["city"] = city_name
            user["plate"] = plate
            city_badge = f"[{plate} {city_name}]"
            self.add_city_points(plate, city_name, 5)
        elif uid in self.user_cities:
            plate, city_name = self.user_cities[uid]
            user["city"] = city_name
            user["plate"] = plate
            self.add_city_points(plate, city_name, 1)

        # AI Wedding Announcer & Natural Language Comment-to-Command Router
        ai_decision = resolve_ai_wedding_command(clean_text, user["nickname"]) if can_trigger_cmd else {"hareket": "yok", "tempo": "ayni", "soz": ""}
        announcer_soz = ai_decision.get("soz", "")
        if can_trigger_cmd and ai_decision.get("hareket") in ("kirdgunu_ring", "halay_snake", "horon", "zeybek"):
            new_mode = ai_decision["hareket"]
            if new_mode != self.scene_mode:
                self.scene_mode = new_mode
                await self.broadcast({"type": "studio_control", "cmd": "scene_mode", "value": new_mode})
        if can_trigger_cmd and ai_decision.get("tempo") in ("yavas", "orta", "hizli", "cosku"):
            self.tempo_gear = ai_decision["tempo"]

        # Parse real viewer interactive commands (Gelin/Damat team, Alkış, Zıpla, Horon/Halay/Zeybek, Sıram)
        cmd_action = ""
        bubble_text = (
            (f"{city_badge} {clean_text}".strip()[:90] if city_badge and city_name.lower() not in low else clean_text)
            if safe_for_bubble
            else ""
        )
        team_choice = self.user_teams.get(uid, "")
        bg_keyword = ""
        if any(w in low for w in ("gelin", "kırmızı", "kirmizi", "kız evi", "kiz evi", "bride", "невеста", "braut", "mariée", "novia", "gəlin")):
            team_choice = "gelin"
            self.user_teams[uid] = "gelin"
            user["team"] = "gelin"
            if any(w in low for w in ("gelin", "bride", "невеста", "braut", "mariée", "novia", "gəlin")):
                bg_keyword = "gelin"
        elif any(w in low for w in ("damat", "mavi", "oğlan evi", "oglan evi", "groom", "жених", "bräutigam", "marié", "novio", "bəy")):
            team_choice = "damat"
            self.user_teams[uid] = "damat"
            user["team"] = "damat"
            if any(w in low for w in ("damat", "groom", "жених", "bräutigam", "marié", "novio", "bəy")):
                bg_keyword = "damat"
        elif not team_choice and costume_gender == "kadin":
            team_choice = "gelin"
            self.user_teams[uid] = "gelin"
            user["team"] = "gelin"
        elif not team_choice and costume_gender == "erkek":
            team_choice = "damat"
            self.user_teams[uid] = "damat"
            user["team"] = "damat"

        if bg_keyword and (now_mono - getattr(self, "_last_bg_lock_ts", 0.0)) >= 6.0:
            self._last_bg_lock_ts = now_mono
            await self.broadcast({
                "type": "bride_groom_locked",
                "user": user,
                "lang": lang_code,
                **self.get_round_state(),
            })

        if team_choice:
            self.team_scores[team_choice] = self.team_scores.get(team_choice, 0) + 5

        if can_trigger_cmd:
            if any(w in low for w in ("!sıram", "!siram", "sıram", "!puan", "puanım")):
                bubble_text = self.get_user_rank_summary(uid)
                cmd_action = "jump"
            elif any(w in low for w in ("!profil", "!seviye", "!xp")):
                prof = self.viewer_store.get_profile(uid) or {"level": 1, "xp": 0, "total_diamonds": 0}
                bubble_text = f"Lv.{prof['level']} | {prof['xp']} XP | {prof['total_diamonds']} 💎"
                cmd_action = "jump"
            elif any(w in low for w in ("alkış", "alkis", "takı", "taki", "bravo", "helal")):
                cmd_action = "clap"
            elif any(w in low for w in ("zıpla", "zipla", "hop", "hey", "tey", "hobaa", "sıkıştır", "sikistir")):
                cmd_action = "jump"
            elif any(w in low for w in ("horon", "kolbastı", "kolbasti", "titret")):
                cmd_action = "horon_burst"
            elif any(w in low for w in ("zeybek", "efe", "harmandalı", "harmandali")):
                cmd_action = "zeybek_pose"
            else:
                zemin_m = re.match(r"^[!/]?zemin\s+(alt[ıi]gen|seramik|kum|kumsal|toprak)\b", low)
                if zemin_m:
                    raw_floor = zemin_m.group(1).replace("ı", "i")
                    floor_val = "kum" if raw_floor == "kumsal" else raw_floor
                    await self.broadcast({"type": "director_control", "floor": floor_val})
                    bubble_text = f"🏛️ Zemin: {floor_val.upper()}"
                elif any(w in low for w in ("!parasac", "!para", "para saç", "para sac", "parasac")):
                    await self.broadcast({"type": "world_fx", "fx": "para_throw", "user": user})
                    bubble_text = "💸 Para Saçıldı!"
                elif any(w in low for w in ("!ateşböceği", "!atesbocegi", "ateşböceği", "atesbocegi")):
                    await self.broadcast({"type": "world_fx", "fx": "fireflies", "user": user})
                    bubble_text = "✨ Ateşböcekleri!"
                elif any(w in low for w in ("!kuşlar", "!kuslar", "kuşlar uçsun", "kuslar ucsun")):
                    await self.broadcast({"type": "world_fx", "fx": "birds", "user": user})
                    bubble_text = "🕊️ Kuş Sürüsü!"
                elif any(w in low for w in ("!çocuklar", "!cocuklar", "çocuklar koşsun", "cocuklar kossun")):
                    await self.broadcast({"type": "world_fx", "fx": "kids", "user": user})
                    bubble_text = "👧 Çocuklar Coştu!"
                elif any(w in low for w in ("!köylüler", "!koyluler", "köylüler yürüsün", "koyluler yurusun")):
                    await self.broadcast({"type": "world_fx", "fx": "wanderers", "user": user})
                    bubble_text = "🧑‍🌾 Köy Canlandı!"
                elif any(w in low for w in ("!ziyafet", "!sofra", "!masa")):
                    await self.broadcast({"type": "world_fx", "fx": "banquet", "user": user})
                    bubble_text = "🍽️ Ziyafet Masaları!"

        voted_choice = await self.event_scheduler.cast_vote(uid, clean_text)
        if voted_choice in ("A", "B", "C"):
            cmd_action = "jump"
            bubble_text = f"🗳️ Oy: {voted_choice}"

        try:
            self.viewer_store.record_activity(uid, user.get("nickname", uid), xp_delta=3, chats_delta=1)
        except Exception:
            pass

        is_free_join_word = bool(
            re.match(
                r"^(?:katıl|katil|join|halay|play|me+|yo+|я+|мен|бен|ben|bn|moi|ich|eu|войти|танец|انضمام|entrar|mitmachen|rejoindre|qoşul|quiero|quiere|vamos|dale|hola|salut|hallo|привет|давай|го|selam|slm)$",
                norm_cmd,
            )
            or any(w in low for w in ("yo quiero", "quiero bailar", "quiero entrar", "me quiero", "beni de al"))
        )
        if uid not in self.joined_uids:
            if costume_gender or self.join_on_any_chat or (self.join_on_keyword and (is_free_join_word or any(k in low for k in self.join_keywords))):
                await self.queue_join(user, reason="kostum" if costume_gender else "yorum", flush_now=True)
        if uid in self.joined_uids:
            self._touch_dancer_stamina(uid, 40.0, cap_sec=180.0)
        else:
            self.last_active_ts[uid] = time.time()

        user_likes_now = self.user_likes.get(uid, 0)
        is_joined_now = uid in self.joined_uids
        rem_likes_now = 0 if is_joined_now else max(1, self.like_threshold - user_likes_now)

        if safe_for_bubble and bubble_text:
            await self.broadcast({
                "type": "live_feed",
                "kind": "chat",
                "user": user,
                "lang": lang_code,
                "flag": lang_flag,
                "detail": bubble_text[:70],
                "viewer_count": self.viewer_count,
                "total_likes": self.total_likes,
                "total_comments": self.total_comments,
                "total_gifts": self.total_gifts,
            })
        pill_trigger = ""
        if costume_gender in ("kadin", "kiz") or team_choice == "gelin":
            pill_trigger = "girl"
        elif costume_gender == "erkek" or team_choice == "damat":
            pill_trigger = "boy"
        elif is_free_join_word:
            pill_trigger = "join"
        elif dj_match:
            pill_trigger = "dj"
        elif matched_city:
            pill_trigger = "city"
        await self.broadcast({
            "type": "chat",
            "user": user,
            "lang": lang_code,
            "flag": lang_flag,
            "pill_trigger": pill_trigger,
            "costume_gender": costume_gender,
            "raw_text": clean_text,
            "text": bubble_text,
            "bubble_blocked": not safe_for_bubble,
            "announcer_soz": announcer_soz,
            "tempo_gear": self.tempo_gear,
            "joined": is_joined_now,
            "user_likes": user_likes_now,
            "like_threshold": self.like_threshold,
            "remaining_likes": rem_likes_now,
            "cmd_action": cmd_action,
            "team": team_choice,
            "combo": combo,
            "viewer_count": self.viewer_count,
            "total_likes": self.total_likes,
            "total_comments": self.total_comments,
            "total_gifts": self.total_gifts,
            "team_scores": self.team_scores,
            "country_scores": self.country_scores,
            "lang_scores": self.lang_scores,
            "leaderboard": self.get_leaderboard(),
            "gift_leaderboard": self.get_gift_leaderboard(),
            "top_rewards": self.get_top_rewards(),
            "city_leaderboard": self.get_city_leaderboard(),
            **self.get_round_state(),
        })
        await self._add_party_energy(user, 2)
        await self._check_country_takeover(user)
        await self.check_and_advance_round()
        if safe_for_bubble and clean_text and self.ai_chat_hook is not None:
            leader_nick = str((self.halaybasi_user or {}).get("nickname") or "")
            asyncio.create_task(
                self.ai_chat_hook(
                    user,
                    clean_text,
                    is_joined_now,
                    rem_likes_now,
                    len(self.joined_uids),
                    leader_nick,
                )
            )

    async def set_session_id(self, session_id: str) -> None:
        self.tiktok_session_id = session_id.strip()
        self.save_config()
        if self.tiktok_session_id and self.client is not None and hasattr(self.client, "web"):
            try:
                if hasattr(self.client.web, "set_session"):
                    self.client.web.set_session(self.tiktok_session_id)
                elif hasattr(self.client.web, "cookies"):
                    self.client.web.cookies.set("sessionid", self.tiktok_session_id, domain=".tiktok.com")
            except Exception as exc:
                logger.debug("Hot set_session warning: %s", exc)

    async def send_chat_message(self, text: str) -> bool:
        raw = str(text or "").strip()
        if not raw:
            return False
        # Strict Anti-Ban scrub before sending any automated or manual text into TikTok LIVE chat
        clean = _SOLICITATION_BAN_RE.sub(" ", raw)
        clean = _TTS_ITEM_SCRUB_RE.sub(" ", clean)
        msg = re.sub(r"\s+", " ", clean).strip()[:148]
        if not msg:
            return False

        delivered = False
        err_note = ""
        if self.tiktok_session_id and self.is_live_connected:
            if self.client is not None:
                try:
                    await self.client.send_room_chat(msg)
                    delivered = True
                except Exception as exc:
                    err_note = str(exc)
                    logger.debug("TikTok send_room_chat warning: %s", exc)

            # Fallback: direct Webcast HTTP room chat POST with Chrome TLS impersonation
            if not delivered and self.connected_room_id:
                try:
                    async with AsyncSession(impersonate="chrome124", timeout=6.0) as sess:
                        resp = await sess.post(
                            "https://webcast.tiktok.com/webcast/room/chat/",
                            params={
                                "aid": "1988",
                                "room_id": str(self.connected_room_id),
                                "content": msg,
                            },
                            cookies={
                                "sessionid": self.tiktok_session_id,
                                "sessionid_ss": self.tiktok_session_id,
                            },
                            headers={
                                "Referer": "https://www.tiktok.com/",
                                "Origin": "https://www.tiktok.com",
                            },
                        )
                        if resp.status_code == 200:
                            body = resp.json() if "json" in resp.headers.get("content-type", "") else {}
                            if int(body.get("status_code", 0) or 0) == 0:
                                delivered = True
                            else:
                                err_note = f"status_code={body.get('status_code')}"
                        else:
                            err_note = f"http_{resp.status_code}"
                except Exception as exc:
                    err_note = str(exc)
                    logger.debug("Webcast chat fallback warning: %s", exc)
        elif not self.tiktok_session_id:
            err_note = "no_session_id"

        self.last_bot_chat_status = {
            "ts": time.time(),
            "text": msg,
            "delivered": delivered,
            "has_session_id": bool(self.tiktok_session_id),
            "mode": "tiktok_chat" if delivered else "hud_only",
            "note": err_note,
        }
        await self.broadcast({
            "type": "bot_chat_reply",
            "text": msg,
            "delivered": delivered,
            "has_session_id": bool(self.tiktok_session_id),
            "ts": self.last_bot_chat_status["ts"],
        })
        return delivered

    async def process_gift(
        self,
        user: Dict[str, str],
        gift_name: str,
        diamonds: int,
        gift_id: int = 0,
        diamond_unit: int = 0,
        repeat_count: int = 1,
        gift_image: str = "",
    ) -> None:
        uid = user["uid"]
        self.total_gifts += max(1, diamonds)
        self.record_gift_stats(user, gift_id, gift_name, gift_image, max(1, repeat_count), max(1, diamonds))
        self.add_supporter_points(user, max(10.0, diamonds * 10.0))
        try:
            self.viewer_store.record_activity(
                uid, user.get("nickname", uid), xp_delta=max(5, diamonds * 5), diamonds_delta=max(1, diamonds)
            )
        except Exception:
            pass
        now_ts = time.time()
        self.last_active_ts[uid] = now_ts
        cum_dia = self.user_round_diamonds.get(uid, 0) + max(1, diamonds)
        self.user_round_diamonds[uid] = cum_dia
        is_qualified_gift = diamonds >= 5 or cum_dia >= 10

        if is_qualified_gift:
            combo = await self.bump_combo(max(2, min(15, diamonds // 5 + 2)))
        else:
            combo = self.combo_count

        team = self.user_teams.get(uid)
        if team:
            self.team_scores[team] = self.team_scores.get(team, 0) + diamonds * 8

        # +15x City War Points on Every Gift! (Massive hometown competition driver)
        if uid in self.user_cities:
            plate, cname = self.user_cities[uid]
            self.add_city_points(plate, cname, max(15, diamonds * 15))

        if uid in self.user_langs:
            l_code, l_flag = self._record_viewer_lang(uid, self.user_langs[uid], max(10, diamonds * 10))
            user["lang"] = l_code
            user["flag"] = l_flag

        if is_qualified_gift:
            await self.broadcast({
                "type": "live_feed",
                "kind": "gift",
                "user": user,
                "detail": f"{gift_name} ({diamonds} 💎)",
                "viewer_count": self.viewer_count,
                "total_likes": self.total_likes,
                "total_comments": self.total_comments,
                "total_gifts": self.total_gifts,
            })
        if uid not in self.joined_uids and (is_qualified_gift or gift_id == 5655 or "gül" in gift_name.lower() or "rose" in gift_name.lower()):
            await self.queue_join(user, reason="hediye", flush_now=True)

        if diamonds >= 20 or cum_dia >= 20:
            self.dancer_vip.add(uid)
            self.dancer_until[uid] = max(self.dancer_until.get(uid, 0.0), now_ts + (7200.0 if max(diamonds, cum_dia) >= 30 else 1200.0))
        elif is_qualified_gift:
            self.dancer_until[uid] = max(self.dancer_until.get(uid, 0.0), now_ts + (900.0 if cum_dia >= 5 else self.dancer_stamina_sec))

        g_low = gift_name.lower()
        unit_val = diamond_unit or max(1, diamonds // max(1, repeat_count))
        tier = "boss" if diamonds >= self.tier3_min else ("medium" if diamonds >= self.tier2_min else "small")
        if diamonds >= 100:
            special_fx = "disco"
        elif diamonds >= 30:
            special_fx = "giant"
        elif diamonds >= 20:
            special_fx = "shockwave"
        else:
            special_fx = ""
        vip_role_assigned = ""
        role_payload = {"uid": uid, "nickname": user["nickname"], "avatar": user.get("avatar", "")}
        active_throne_min = self.halaybasi_min_diamonds if now_ts < self.halaybasi_gift_until else 30
        active_bride_min = self.bride_min_diamonds if now_ts < self.bride_gift_until else 199
        active_groom_min = self.groom_min_diamonds if now_ts < self.groom_gift_until else 199

        is_rose_only = gift_id == 5655 or (unit_val < 5 and diamonds < 20 and any(k in g_low for k in ("gül", "gul", "rose", "rosa", "роза")))
        gelin_eligible = (diamonds >= active_bride_min or cum_dia >= active_bride_min or (diamonds >= 100 and gift_id in (5924, 6968, 5660)) or (self.gelin_user is None and (diamonds >= 100 or cum_dia >= 199)))
        is_gelin_gift = (not is_rose_only) and gelin_eligible and (
            gift_id in (5924, 6968, 5660)
            or any(k in g_low for k in ("elle kalp", "el kalbi", "hand heart", "handherz", "händen", "coeur avec les mains", "сердце руками", "buket", "bouquet"))
            or (unit_val >= 199 and (user.get("gender") == "kadin" or self.user_teams.get(uid) == "gelin"))
        )
        groom_eligible = (diamonds >= active_groom_min or cum_dia >= active_groom_min or (diamonds >= 99 and gift_id == 6097) or (self.damat_user is None and (diamonds >= 99 or cum_dia >= 199)))
        is_damat_gift = (not is_rose_only) and groom_eligible and (
            gift_id == 6097
            or any(k in g_low for k in ("küçük taç", "kucuk tac", "little crown", "krönchen", "petite couronne", "маленькая корона"))
            or (unit_val >= 199 and (user.get("gender") == "erkek" or self.user_teams.get(uid) == "damat"))
        )
        is_halaybasi_gift = (not is_rose_only) and (
            gift_id in (5879, 5502)
            or any(k in g_low for k in ("donat", "donut", "doughnut", "пончик", "beignet", "galaksi", "galaxy", "галактика", "aslan", "lion", "лев", "para yağmuru"))
            or (re.search(r"\b(?:taç|tac|crown|krone|couronne|корона)\b", g_low) is not None and not is_damat_gift)
            or unit_val >= 199
            or (30 <= unit_val < 50)
        )
        is_zurnaci_gift = (
            gift_id == 5303
            or re.search(r"\b(?:zurna|çay|cay|tea|tee|thé|чай)\b", g_low) is not None
            or (50 <= unit_val < 80)
        )
        is_davulcu_gift = (
            gift_id == 5658
            or any(k in g_low for k in ("davul", "parfüm", "parfum", "perfume", "духи"))
            or (20 <= unit_val < 30)
        )

        async with self._state_lock:
            if is_gelin_gift:
                self.gelin_user = role_payload
                self.bride_gift_until = now_ts + 300.0
                self.bride_min_diamonds = max(199, min(1000, max(diamonds, cum_dia) + 25))
                vip_role_assigned = "gelin"
            elif is_damat_gift:
                self.damat_user = role_payload
                self.groom_gift_until = now_ts + 300.0
                self.groom_min_diamonds = max(199, min(1000, max(diamonds, cum_dia) + 25))
                vip_role_assigned = "damat"
            elif is_halaybasi_gift:
                cur_leader_uid = (self.halaybasi_user or {}).get("uid")
                if diamonds >= active_throne_min or self.halaybasi_user is None or cur_leader_uid == uid:
                    self.halaybasi_user = role_payload
                    hold_sec = 180.0 if diamonds >= 100 else 90.0
                    self.halaybasi_gift_until = now_ts + hold_sec
                    self.halaybasi_min_diamonds = max(30, min(250, diamonds + 10))
                    vip_role_assigned = "halaybasi"
                    for item in self.joined_users:
                        if item["uid"] == uid:
                            item["outfit"] = "halaybasi"
                else:
                    vip_role_assigned = "konfeti"
            elif is_zurnaci_gift:
                self.zurnaci_user = role_payload
                vip_role_assigned = "zurnaci"
            elif is_davulcu_gift:
                self.davulcu_user = role_payload
                vip_role_assigned = "davulcu"
            elif cum_dia >= 20:
                cur_leader_uid = (self.halaybasi_user or {}).get("uid")
                if cum_dia >= active_bride_min and (user.get("gender") == "kadin" or self.user_teams.get(uid) == "gelin"):
                    self.gelin_user = role_payload
                    self.bride_gift_until = now_ts + 300.0
                    self.bride_min_diamonds = max(199, min(1000, cum_dia + 25))
                    vip_role_assigned = "gelin"
                elif cum_dia >= active_groom_min and (self.damat_user is None or user.get("gender") == "erkek" or self.user_teams.get(uid) == "damat"):
                    self.damat_user = role_payload
                    self.groom_gift_until = now_ts + 300.0
                    self.groom_min_diamonds = max(199, min(1000, cum_dia + 25))
                    vip_role_assigned = "damat"
                elif cum_dia >= 50 and self.zurnaci_user is None:
                    self.zurnaci_user = role_payload
                    vip_role_assigned = "zurnaci"
                elif cum_dia >= 30 and (self.halaybasi_user is None or cum_dia >= active_throne_min or cur_leader_uid == uid):
                    self.halaybasi_user = role_payload
                    self.halaybasi_gift_until = now_ts + 90.0
                    self.halaybasi_min_diamonds = max(30, min(250, cum_dia + 10))
                    vip_role_assigned = "halaybasi"
                elif self.davulcu_user is None or cum_dia >= 20:
                    self.davulcu_user = role_payload
                    vip_role_assigned = "davulcu"
            elif (5 <= diamonds < 20 or 5 <= cum_dia < 20) and not is_rose_only:
                vip_role_assigned = "konfeti"
            elif 5 <= cum_dia < 20:
                vip_role_assigned = "konfeti"

        # v45: Country War boost + Shared Feast Bar + Sabotage Powers (TikTok Live Wired)
        mult = self._score_mult()
        g_lang = user.get("lang") or self.user_langs.get(uid, "tr")
        self.lang_scores[g_lang] = self.lang_scores.get(g_lang, 0) + int(diamonds * 25 * mult)
        await self._check_country_takeover(user)
        await self._add_party_energy(user, int(diamonds * 10 * mult))

        if 10 <= diamonds < 20:
            victim_obj = self.halaybasi_user if (isinstance(self.halaybasi_user, dict) and str(self.halaybasi_user.get("uid", "")) != uid) else None
            if victim_obj is None:
                rivals = sorted(
                    [d for d in self.joined_users if str(d.get("uid", "")) != uid],
                    key=lambda d: -self._dancer_priority_score(str(d.get("uid", ""))),
                )
                victim_obj = rivals[0] if rivals else None
            if victim_obj and victim_obj.get("uid"):
                v_uid = str(victim_obj["uid"])
                self.shrunk_until[v_uid] = now_ts + 30.0
                self.giant_until[uid] = now_ts + 30.0
                await self.broadcast({
                    "type": "sabotage_fx",
                    "action": "shrink_rival",
                    "attacker": user,
                    "victim": victim_obj,
                    "duration": 30,
                })
        elif 20 <= diamonds < 30:
            await self.broadcast({
                "type": "sabotage_fx",
                "action": "cut_music",
                "attacker": user,
                "duration": 15,
            })
            if self.jukebox_request_fn is not None:
                asyncio.create_task(self.jukebox_request_fn("", user["nickname"], True, lang=g_lang, flag=user.get("flag", "🌍")))
        elif diamonds >= 30:
            protected_uids = {
                str(r["uid"])
                for r in (self.halaybasi_user, self.gelin_user, self.damat_user)
                if isinstance(r, dict) and r.get("uid")
            }
            protected_uids.add(uid)
            candidates = sorted(
                [d for d in self.joined_users if str(d.get("uid", "")) not in protected_uids],
                key=lambda d: self._dancer_priority_score(str(d.get("uid", ""))),
            )
            victims = candidates[:3]
            for v in victims:
                v_uid = str(v.get("uid", ""))
                if v_uid:
                    self.sabotage_penalty[v_uid] = self.sabotage_penalty.get(v_uid, 0.0) + 1500.0
                if v_uid and isinstance(self.supporter_points.get(v_uid), dict):
                    self.supporter_points[v_uid]["score"] = max(
                        0.0, float(self.supporter_points[v_uid].get("score", 0.0)) - 150.0
                    )
            await self.broadcast({
                "type": "sabotage_fx",
                "action": "mega_shock" if diamonds >= 50 else "boot_back",
                "attacker": user,
                "victims": victims,
                "stage_order": self.get_stage_order(),
            })

        # Non-Turkish gifters (diamonds >= 5 or cum_dia >= 10): interrupt Halay for 1 regional song matching their country/language
        if (
            self.jukebox_request_fn is not None
            and g_lang != "tr"
            and is_qualified_gift
            and not (20 <= diamonds < 30)
            and (now_ts - float(getattr(self, "_last_regional_gift_music_ts", {}).get(uid, 0.0))) >= 20.0
        ):
            if not hasattr(self, "_last_regional_gift_music_ts"):
                self._last_regional_gift_music_ts = {}
            self._last_regional_gift_music_ts[uid] = now_ts
            asyncio.create_task(self.jukebox_request_fn("", user["nickname"], True, lang=g_lang, flag=user.get("flag", "🌍")))

        self._save_active_room_state()

        await self.broadcast({
            "type": "gift",
            "user": user,
            "gift_id": gift_id,
            "gift_name": gift_name,
            "gift_image": gift_image,
            "diamonds": diamonds,
            "round_diamonds": cum_dia,
            "diamond_unit": unit_val,
            "repeat_count": max(1, repeat_count),
            "tier": tier,
            "special_fx": special_fx,
            "vip_role": vip_role_assigned,
            "combo": combo,
            "viewer_count": self.viewer_count,
            "total_likes": self.total_likes,
            "total_comments": self.total_comments,
            "total_gifts": self.total_gifts,
            "halaybasi": self.halaybasi_user,
            "davulcu": self.davulcu_user,
            "zurnaci": self.zurnaci_user,
            "gelin": self.gelin_user,
            "damat": self.damat_user,
            "team_scores": self.team_scores,
            "country_scores": self.country_scores,
            "lang_scores": self.lang_scores,
            "leaderboard": self.get_leaderboard(),
            "gift_leaderboard": self.get_gift_leaderboard(),
            "top_rewards": self.get_top_rewards(),
            "city_leaderboard": self.get_city_leaderboard(),
            **self.get_round_state(),
        })
        if vip_role_assigned in ("halaybasi", "gelin", "damat", "zurnaci", "davulcu") and self.ai_role_hook is not None:
            g_lang = user.get("lang") or self.user_langs.get(uid, "tr")
            asyncio.create_task(self.ai_role_hook(user, vip_role_assigned, gift_name, diamonds, g_lang))
        await self.check_and_advance_round()

    async def _promote_from_queue(self) -> List[Dict[str, Any]]:
        to_promote: List[Dict[str, Any]] = []
        async with self._state_lock:
            slots = max(0, self.max_halay_seats - len(self.joined_users))
            if slots > 0 and self.waiting_queue:
                self.waiting_queue.sort(key=lambda u: -self._dancer_priority_score(str(u.get("uid", ""))))
                while len(to_promote) < slots and self.waiting_queue:
                    next_u = self.waiting_queue.pop(0)
                    nuid = str(next_u.get("uid") or "")
                    self.waiting_uids.discard(nuid)
                    if not nuid or nuid in self.joined_uids:
                        continue
                    to_promote.append(next_u)
        promoted: List[Dict[str, Any]] = []
        for next_u in to_promote:
            await self.queue_join(next_u, reason="sira", flush_now=True)
            promoted.append(next_u)
        return promoted

    async def sweep_inactive_dancers(self, now_ts: Optional[float] = None) -> List[Dict[str, Any]]:
        now = float(now_ts if now_ts is not None else time.time())
        removed: List[Dict[str, Any]] = []
        async with self._state_lock:
            vip_uids = {
                str(r["uid"])
                for r in (self.halaybasi_user, self.davulcu_user, self.zurnaci_user, self.gelin_user, self.damat_user)
                if isinstance(r, dict) and r.get("uid")
            } | set(self.reigning_champions)
            kept: List[Dict[str, Any]] = []
            has_seat_pressure = (len(self.joined_users) >= self.max_halay_seats) or (len(self.waiting_queue) > 0)
            for item in self.joined_users:
                uid = str(item.get("uid") or "")
                if not uid or uid in vip_uids:
                    kept.append(item)
                    continue
                reason = ""
                last_act = float(self.last_active_ts.get(uid, now))
                if uid in self._seen_in_ranks:
                    last_r = float(self._last_ranks_seen.get(uid, now))
                    if (now - last_r) > 35.0 and (now - last_act) > 35.0:
                        reason = "left_room"
                if not reason and has_seat_pressure and now > float(self.dancer_until.get(uid, now + self.dancer_stamina_sec)):
                    reason = "afk"
                if reason:
                    self.joined_uids.discard(uid)
                    self.dancer_until.pop(uid, None)
                    removed.append({"uid": uid, "nickname": item.get("nickname", "Misafir"), "reason": reason, "user": item})
                else:
                    kept.append(item)
            if removed:
                self.joined_users = kept
        if removed:
            for rem in removed:
                await self.broadcast({
                    "type": "leave_halay",
                    "uid": rem["uid"],
                    "nickname": rem["nickname"],
                    "user": rem["user"],
                    "reason": rem["reason"],
                    "seat_count": len(self.joined_users),
                    "max_seats": self.max_halay_seats,
                    "queue_count": len(self.waiting_queue),
                    "stage_order": self.get_stage_order(),
                })
            await self._promote_from_queue()
        return removed

    async def queue_join(self, user: Dict[str, Any], reason: str = "begeni", flush_now: bool = False) -> None:
        uid = user["uid"]
        now_ts = time.time()
        evict_payload: Optional[Dict[str, Any]] = None
        queue_payload: Optional[Dict[str, Any]] = None
        should_flush_now = False
        need_delayed_task = False

        async with self._state_lock:
            self.last_active_ts[uid] = now_ts
            if uid in self.joined_uids:
                self._touch_dancer_stamina(uid, 30.0, cap_sec=240.0 if reason == "hediye" else 180.0)
                return
            vip_uids = set(self.dancer_vip) | {
                str(r["uid"])
                for r in (self.halaybasi_user, self.davulcu_user, self.zurnaci_user, self.gelin_user, self.damat_user)
                if isinstance(r, dict) and r.get("uid")
            }
            if len(self.joined_users) >= self.max_halay_seats:
                if reason == "hediye":
                    evict_idx = min(
                        (i for i, item in enumerate(self.joined_users) if str(item.get("uid", "")) not in vip_uids),
                        key=lambda i: self._dancer_priority_score(str(self.joined_users[i].get("uid", ""))),
                        default=None,
                    )
                    if evict_idx is not None:
                        evicted = self.joined_users.pop(evict_idx)
                        ev_uid = str(evicted.get("uid") or "")
                        if ev_uid:
                            self.joined_uids.discard(ev_uid)
                            evict_payload = {
                                "type": "leave_halay",
                                "uid": ev_uid,
                                "nickname": evicted.get("nickname", "Misafir"),
                                "user": evicted,
                                "reason": "vip_bump",
                                "seat_count": len(self.joined_users),
                                "max_seats": self.max_halay_seats,
                                "queue_count": len(self.waiting_queue),
                                "stage_order": self.get_stage_order(),
                            }
                if len(self.joined_users) >= self.max_halay_seats:
                    if uid not in self.waiting_uids:
                        self.waiting_uids.add(uid)
                        self.waiting_queue.append(user)
                    self.waiting_queue.sort(key=lambda u: -self._dancer_priority_score(str(u.get("uid", ""))))
                    q_pos = next((i + 1 for i, u in enumerate(self.waiting_queue) if str(u.get("uid")) == uid), len(self.waiting_queue))
                    queue_payload = {
                        "type": "queue_status",
                        "user": user,
                        "queue_pos": q_pos,
                        "seat_count": len(self.joined_users),
                        "max_seats": self.max_halay_seats,
                        "queue_count": len(self.waiting_queue),
                        "stage_order": self.get_stage_order(),
                    }
            if queue_payload is None:
                if uid in self.waiting_uids:
                    self.waiting_uids.discard(uid)
                    self.waiting_queue = [u for u in self.waiting_queue if str(u.get("uid")) != uid]
                self.add_supporter_points(user, 5.0)
                if uid in self.user_teams:
                    user["team"] = self.user_teams[uid]
                if reason == "hediye":
                    self.dancer_until[uid] = max(self.dancer_until.get(uid, 0.0), now_ts + 240.0)
                else:
                    self.dancer_until[uid] = max(self.dancer_until.get(uid, 0.0), now_ts + self.dancer_stamina_sec)
                self.joined_uids.add(uid)
                self.joined_users.append(user)
                self._pending_joins.append(user)
                should_flush_now = flush_now or len(self._pending_joins) >= 2
                need_delayed_task = (not should_flush_now) and (self.flush_task is None or self.flush_task.done())

        if evict_payload is not None:
            await self.broadcast(evict_payload)
        if queue_payload is not None:
            await self.broadcast(queue_payload)
            return

        try:
            self.viewer_store.record_activity(uid, user.get("nickname", uid), xp_delta=5, joined=True)
        except Exception:
            pass

        if should_flush_now:
            await self._flush_joins(reason)
        elif need_delayed_task:
            self.flush_task = asyncio.create_task(self._delayed_flush(reason))

    async def _delayed_flush(self, reason: str) -> None:
        await asyncio.sleep(1.15)
        await self._flush_joins(reason)

    async def _flush_joins(self, reason: str) -> None:
        async with self._flush_lock:
            while self._pending_joins:
                async with self._state_lock:
                    batch = self._pending_joins[:2]
                    self._pending_joins = self._pending_joins[2:]
                    if not batch:
                        break
                    payload = {
                        "type": "join_halay",
                        "users": batch,
                        "reason": reason,
                        "seat_count": len(self.joined_users),
                        "max_seats": self.max_halay_seats,
                        "queue_count": len(self.waiting_queue),
                        "stage_order": self.get_stage_order(),
                    }
                await self.broadcast(payload)
                if self._pending_joins:
                    await asyncio.sleep(0.8)

    async def auto_discover_and_connect(self) -> None:
        await self._emit_status("🔍 Şu an yayında olan gerçek bir TikTok canlı odası aranıyor...")
        self.like_threshold = 100
        self.join_on_keyword = True
        self.join_on_any_chat = False
        self.join_on_follow = False
        self.join_on_enter = False
        handle = await discover_active_live_stream(exclude_handle=self.target_username)
        if handle:
            await self.connect_tiktok(handle)
        else:
            await self._emit_status("⚠️ Otomatik yayın bulunamadı — üst kutuya herhangi bir canlı @kullanıcı_adı yazıp Bağla'ya basın.")

    async def connect_tikfinity(self, ws_url: str = "ws://localhost:21213/") -> None:
        if self.tikfinity_task and not self.tikfinity_task.done():
            self.tikfinity_task.cancel()
        self.tikfinity_task = asyncio.create_task(self._tikfinity_loop(ws_url))

    async def _handle_tikfinity_event(self, ev: str, data: Dict[str, Any]) -> None:
        raw_pic = str(data.get("profilePictureUrl", "") or "")
        uid = str(data.get("uniqueId") or data.get("userId") or "guest")
        u = {
            "uid": uid,
            "nickname": sanitize_nickname(str(data.get("nickname") or uid or "İzleyici"), fallback_uid=uid, max_len=24),
            "avatar": f"/api/avatar?url={urllib.parse.quote(raw_pic, safe='')}" if raw_pic.startswith("http") else "",
        }
        msg_id = str(data.get("msgId") or data.get("msg_id") or "")
        if ev == "like":
            cnt = max(1, int(data.get("likeCount", 15) or 15))
            st_tot = int(data.get("totalLikeCount", 0) or 0)
            self.event_engine.submit_like(
                uid, u, cnt, st_tot,
                lambda usr, total_cnt, st: self.process_like(usr, total_cnt, stream_total=st),
            )
        elif ev == "chat":
            txt = str(data.get("comment", "") or "").strip()
            if txt:
                await self.event_engine.submit(
                    EventPriority.CHAT, "chat",
                    lambda usr=u, c=txt: self.process_chat(usr, c),
                    dedup_key=f"tf_chat:{msg_id}" if msg_id else "",
                )
        elif ev == "gift":
            gid = int(data.get("giftId", 0) or 0)
            gift_type = int(data.get("giftType", 0) or 0)
            repeat_end = data.get("repeatEnd")
            r_cnt = max(1, int(data.get("repeatCount", 1) or 1))
            d_unit = max(1, int(data.get("diamondCount", 5) or 5))
            # TikFinity sends repeatEnd=False on every streak tick; wait for repeatEnd=True for combo gifts
            if gift_type == 1 and repeat_end is False:
                return
            total_dia = d_unit * r_cnt
            prio = (
                EventPriority.BIG_GIFT
                if total_dia >= 100
                else (EventPriority.SPECIAL_GIFT if total_dia >= 20 else EventPriority.NORMAL_GIFT)
            )
            dedup = f"tf_gift:{msg_id}:{gid}:{r_cnt}" if msg_id else f"tf_gift:{uid}:{gid}:{r_cnt}:{int(time.time() // 2)}"
            await self.event_engine.submit(
                prio, "gift",
                lambda usr=u, gn=str(data.get("giftName", "Hediye")), td=total_dia, gi=gid, du=d_unit, rp=r_cnt: self.process_gift(
                    usr, gn, td, gift_id=gi, diamond_unit=du, repeat_count=rp
                ),
                dedup_key=dedup,
            )
        elif ev == "follow" and self.join_on_follow:
            await self.event_engine.submit(
                EventPriority.FOLLOW, "follow",
                lambda usr=u: self.queue_join(usr, reason="takip"),
                dedup_key=f"tf_follow:{uid}",
            )

    async def _tikfinity_loop(self, ws_url: str) -> None:
        backoff = 3.0
        connected_once = False
        while True:
            try:
                async with websockets.connect(ws_url) as ws:
                    connected_once = True
                    backoff = 3.0
                    await self._emit_status(f"🟢 TikFinity bağlandı ({ws_url})")
                    async for raw in ws:
                        msg = json.loads(raw)
                        ev = msg.get("event", "")
                        data = msg.get("data", {}) or {}
                        await self._handle_tikfinity_event(ev, data)
            except asyncio.CancelledError:
                return
            except Exception:
                if not connected_once:
                    await self._emit_status(
                        "ℹ️ Bilgisayarında TikFinity masaüstü programı açık değil (gerekli değil!). Üstteki kutuya direkt @kullanıcı_adı yazıp Bağla'ya bas veya '⚡ Canlı Yayın Bul & Test Et'e tıkla."
                    )
                    return
                await asyncio.sleep(backoff)
                backoff = min(30.0, backoff * 2.0)

    async def kick_dancer(self, uid: str) -> bool:
        clean_uid = str(uid or "").strip()
        if not clean_uid:
            return False
        removed_user: Optional[Dict[str, Any]] = None
        async with self._state_lock:
            self.joined_uids.discard(clean_uid)
            new_joined: List[Dict[str, Any]] = []
            for item in self.joined_users:
                if str(item.get("uid", "")) == clean_uid:
                    removed_user = item
                else:
                    new_joined.append(item)
            self.joined_users = new_joined
            self.waiting_uids.discard(clean_uid)
            self.waiting_queue = [u for u in self.waiting_queue if str(u.get("uid", "")) != clean_uid]
        if removed_user is not None:
            await self.broadcast({
                "type": "leave_halay",
                "uid": clean_uid,
                "nickname": removed_user.get("nickname", "Misafir"),
                "user": removed_user,
                "reason": "admin_kick",
                "seat_count": len(self.joined_users),
                "max_seats": self.max_halay_seats,
                "queue_count": len(self.waiting_queue),
                "stage_order": self.get_stage_order(),
            })
            await self._promote_from_queue()
            return True
        return False

    async def promote_halaybasi(self, uid: str) -> bool:
        clean_uid = str(uid or "").strip()
        if not clean_uid:
            return False
        target_user: Optional[Dict[str, Any]] = None
        async with self._state_lock:
            for item in self.joined_users:
                if str(item.get("uid", "")) == clean_uid:
                    target_user = dict(item)
                    item["outfit"] = "halaybasi"
                    break
            if target_user is None:
                return False
            self.halaybasi_user = {
                "uid": clean_uid,
                "nickname": target_user.get("nickname", "Halaybaşı"),
                "avatar": target_user.get("avatar", ""),
            }
            self.halaybasi_gift_until = time.time() + 180.0
            self.dancer_vip.add(clean_uid)
        await self.broadcast({
            "type": "gift",
            "user": target_user,
            "gift_name": "Yönetici Ataması",
            "diamonds": 30,
            "vip_role": "halaybasi",
            "vip_roles": self.get_vip_roles(),
            "stage_order": self.get_stage_order(),
            **self.get_round_state(),
        })
        return True

    async def update_rules(self, payload: Dict[str, Any]) -> None:
        if "threshold" in payload:
            self.like_threshold = max(1, int(payload["threshold"]))
        if "tier2_min" in payload:
            self.tier2_min = max(2, int(payload["tier2_min"]))
        if "tier3_min" in payload:
            self.tier3_min = max(5, int(payload["tier3_min"]))
        if "join_on_keyword" in payload:
            self.join_on_keyword = bool(payload["join_on_keyword"])
        if "join_on_any_chat" in payload:
            self.join_on_any_chat = bool(payload["join_on_any_chat"])
        if "join_on_follow" in payload:
            self.join_on_follow = bool(payload["join_on_follow"])
        if "join_on_enter" in payload:
            self.join_on_enter = bool(payload["join_on_enter"])
        self.save_config()
        await self._emit_status("Katılım ve jeton kuralları güncellendi.")

    async def trigger_studio_control(self, cmd_name: str, value: Any = None) -> None:
        if cmd_name == "scene_mode" and isinstance(value, str):
            self.scene_mode = value
            self.save_config()
        elif cmd_name == "avatar_style" and isinstance(value, str):
            self.avatar_style = value
            self.save_config()
        elif cmd_name == "music_preset" and isinstance(value, str):
            self.music_preset = value
            self.save_config()
        elif cmd_name == "tts_enabled":
            self.tts_enabled = bool(value)
            self.save_config()
        await self.broadcast({"type": "studio_control", "cmd": cmd_name, "value": value})

    async def simulate_studio_action(self, kind: str) -> None:
        """Strictly manual 1-click studio test helper for off-air scene & HUD verification."""
        sample_names = [
            "Azad_21", "Zeynep_K", "Baran_47", "Elif_Su", "Mert_Can",
            "Dilan_65", "Kerem_06", "Berfin_34", "Emre_TS", "Buse_Nur",
        ]
        if kind == "add_5":
            for _ in range(5):
                idx = len(self.joined_uids) + 1
                nm = f"{random.choice(sample_names)}_{idx}"
                u = {"uid": f"preview_{idx}_{random.randint(100,999)}", "nickname": nm, "avatar": "", "team": "gelin" if idx % 2 == 0 else "damat"}
                await self.queue_join(u, reason="stüdyo_test", flush_now=True)
        elif kind == "test_gold":
            target = self.joined_users[-1] if self.joined_users else {"uid": "preview_vip", "nickname": "VIP_Konuk", "avatar": ""}
            await self.process_gift(target, "Parfüm", max(20, self.tier2_min), gift_id=5658, diamond_unit=20)
        elif kind == "test_donut":
            target = self.joined_users[0] if self.joined_users else {"uid": "preview_boss", "nickname": "Ağa_Halaybaşı", "avatar": ""}
            await self.process_gift(target, "Donut", 30, gift_id=5879, diamond_unit=30)
        elif kind == "test_boss":
            target = self.joined_users[0] if self.joined_users else {"uid": "preview_boss", "nickname": "Ağa_Halaybaşı", "avatar": ""}
            await self.process_gift(target, "Kraliyet Tacı", max(199, self.tier3_min), gift_id=5502, diamond_unit=199)
        elif kind == "next_round":
            self.round_ends_at = 0.0
            await self.check_and_advance_round()
        elif kind == "test_fever":
            self.combo_count = max(15, self.combo_count + 15)
            self.last_combo_ts = time.monotonic()
            await self.broadcast({"type": "fever_burst", "combo": self.combo_count})

    async def _live_room_stats_poller(self, username: str) -> None:
        """Maintains round state, AFK/presence sweep, and periodic saves without hammering TikTok HTTP APIs while live."""
        tick = 0
        while self.is_live_connected and self.is_watching and self.target_username == username:
            try:
                await self.sweep_inactive_dancers()
                if tick % 3 == 0:
                    await self.check_and_advance_round()
                    self._save_active_room_state()
                    await self._emit_status()
            except asyncio.CancelledError:
                break
            except Exception:
                pass
            tick += 1
            await asyncio.sleep(4.0)

    async def reset_state(self) -> None:
        self.joined_uids.clear()
        self.joined_users.clear()
        self.waiting_queue.clear()
        self.waiting_uids.clear()
        self.last_active_ts.clear()
        self._seen_in_ranks.clear()
        self._last_ranks_seen.clear()
        self.user_likes.clear()
        self.dancer_vip.clear()
        self.dancer_until.clear()
        self.total_likes = 0
        self.total_comments = 0
        self.total_gifts = 0
        self.total_entries = 0
        self.total_claps = 0
        self.supporter_points.clear()
        self.gift_senders.clear()
        self.gift_totals.clear()
        self.user_round_diamonds.clear()
        self.user_teams.clear()
        self.team_scores = {"gelin": 0, "damat": 0}
        self.city_scores.clear()
        self.user_cities.clear()
        self.user_langs.clear()
        self.country_scores = {"tr": 0, "world": 0}
        self.lang_scores.clear()
        self.user_cmd_cooldowns.clear()
        self.halaybasi_user = None
        self.davulcu_user = None
        self.zurnaci_user = None
        self.gelin_user = None
        self.damat_user = None
        self.halaybasi_gift_until = 0.0
        self.halaybasi_min_diamonds = 30
        self.bride_min_diamonds = 199
        self.bride_gift_until = 0.0
        self.groom_min_diamonds = 199
        self.groom_gift_until = 0.0
        self.round_ends_at = time.time() + float(self.round_duration_sec)
        self.global_like_bucket = 0
        self.tempo_like_bucket = 0
        self.tempo_gear = "orta"
        self.dominant_country = "tr"
        self.party_meter = 0
        self.party_patron = None
        self.party_active_until = 0.0
        self.reigning_champions.clear()
        self.shrunk_until.clear()
        self.giant_until.clear()
        self.sabotage_penalty.clear()
        self._pending_joins.clear()
        if self.connected_room_id:
            self._active_state_room_id = self.connected_room_id
        self._save_active_room_state()
        await self.broadcast({"type": "reset_halay"})
        await self._emit_status("Halay meydanı ve liderlik tablosu sıfırlandı.")

    async def _emit_status(self, note: str = "") -> None:
        if note:
            self.status_note = note
        await self.broadcast({
            "type": "status",
            "connected": self.is_live_connected,
            "watching": self.is_watching,
            "username": self.target_username,
            "room_id": self.connected_room_id,
            "viewer_count": self.viewer_count,
            "total_likes": self.total_likes,
            "total_comments": self.total_comments,
            "total_gifts": self.total_gifts,
            "tempo_gear": self.tempo_gear,
            "like_threshold": self.like_threshold,
            "tier2_min": self.tier2_min,
            "tier3_min": self.tier3_min,
            "scene_mode": self.scene_mode,
            "avatar_style": self.avatar_style,
            "music_preset": self.music_preset,
            "tts_enabled": self.tts_enabled,
            "join_on_keyword": self.join_on_keyword,
            "join_on_any_chat": self.join_on_any_chat,
            "join_on_follow": self.join_on_follow,
            "join_on_enter": self.join_on_enter,
            "joined_count": len(self.joined_uids),
            "halaybasi": self.halaybasi_user,
            "davulcu": self.davulcu_user,
            "zurnaci": self.zurnaci_user,
            "gelin": self.gelin_user,
            "damat": self.damat_user,
            "roles": self.get_vip_roles(),
            "leaderboard": self.get_leaderboard(),
            "gift_leaderboard": self.get_gift_leaderboard(),
            "top_rewards": self.get_top_rewards(),
            "city_leaderboard": self.get_city_leaderboard(),
            "team_scores": self.team_scores,
            "country_scores": self.country_scores,
            "lang_scores": self.lang_scores,
            **self.get_round_state(),
            "note": self.status_note,
            "ts": time.time(),
        })
