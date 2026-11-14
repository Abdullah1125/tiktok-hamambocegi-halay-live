# -*- coding: utf-8 -*-
from __future__ import annotations

import asyncio
from collections import OrderedDict, deque
import json
import logging
import os
from pathlib import Path
import random
import re
import time
import uuid
from typing import Any, Callable, Coroutine, Dict, List, Optional

import edge_tts
import httpx

logger = logging.getLogger("halay.ai_host")

BroadcastFn = Callable[[Dict[str, Any]], Coroutine[Any, Any, None]]
SendChatFn = Callable[[str], Coroutine[Any, Any, bool]]

LANG_META: Dict[str, Dict[str, str]] = {
    "tr": {"flag": "🇹🇷", "label": "TR", "name": "Turkish", "voice": "tr-TR-EmelNeural", "rate": "+12%"},
    "ru": {"flag": "🇷🇺", "label": "RU", "name": "Russian", "voice": "ru-RU-SvetlanaNeural", "rate": "+10%"},
    "ar": {"flag": "🇸🇦", "label": "AR", "name": "Arabic", "voice": "ar-SA-ZariyahNeural", "rate": "+8%"},
    "en": {"flag": "🇬🇧", "label": "EN", "name": "English", "voice": "en-US-AvaMultilingualNeural", "rate": "+10%"},
    "es": {"flag": "🇪🇸", "label": "ES", "name": "Spanish", "voice": "es-ES-ElviraNeural", "rate": "+10%"},
    "de": {"flag": "🇩🇪", "label": "DE", "name": "German", "voice": "de-DE-KatjaNeural", "rate": "+10%"},
    "fr": {"flag": "🇫🇷", "label": "FR", "name": "French", "voice": "fr-FR-DeniseNeural", "rate": "+10%"},
    "az": {"flag": "🇦🇿", "label": "AZ", "name": "Azerbaijani", "voice": "az-AZ-BanuNeural", "rate": "+10%"},
}

# Strict TikTok Live Compliance Filter: zero gift/coin/diamond/like/tap solicitation in any language
_SOLICITATION_BAN_RE = re.compile(
    r"\b("
    r"hediye|jeton|elmas|bağış|bagis|donate|ödül|odul|beğeni|begeni|beğen|begen|"
    r"send\s*gift|gifts?|coins?|diamonds?|likes?|double[\s-]*tap|"
    r"подарок|подарки|монет|алмаз|донат|лайк|лайков|тапай|"
    r"هدية|هدايا|عملات|الماس|إعجاب|اعجاب|"
    r"regalo|monedas|diamantes|geschenk|münzen|cadeau"
    r")\b",
    re.IGNORECASE,
)

# Zero-Gift-TTS Shield: scrub gift/item names from spoken audio so TikTok ASR hears 100% organic wedding banter
_TTS_ITEM_SCRUB_RE = re.compile(
    r"(?:"
    r"\b(?:donat|donut|doughnut|ponçik|beignet)\b|"
    r"\b(?:parfüm|parfum|perfume)\b|"
    r"\b(?:küçük\s*taç|kucuk\s*tac|little\s*crown|krönchen|petite\s*couronne)\b|"
    r"\b(?:elle?\s*kalp|el\s*kalbi|hand\s*heart|handherz|heart)\b|"
    r"\b(?:parmak\s*kalp|finger\s*heart|fingerherz)\b|"
    r"\b(?:buket|bouquet)\b|"
    r"\b(?:galaksi|galaxy)\b|"
    r"\b(?:çay|cay|tea|tee|thé)\b|"
    r"\b(?:taç|tac|crown|krone|couronne)\b|"
    r"\b(?:gül|gul|rose|aslan|lion|balina|whale)\b|"
    r"пончик\w*|духи\w*|галактик\w*|сердце\s*руками|маленькая\s*корона|корон[аы]|чай|роз[аы]|"
    r"دونات|عطر|مجرة|قلب\s*يد|شاي|تاج|وردة"
    r")",
    re.IGNORECASE,
)

_CYRILLIC_RE = re.compile(r"[\u0400-\u04FF]")
_ARABIC_RE = re.compile(r"[\u0600-\u06FF\u0750-\u077F]")
_TR_CHARS_RE = re.compile(r"[çğıöşüÇĞİÖŞÜ]")
_AZ_CHARS_RE = re.compile(r"[əƏğĞıİöÖşŞüÜçÇ]")


def _load_gemini_api_key() -> str:
    key = os.environ.get("GEMINI_API_KEY", "").strip().strip('"').strip("'")
    if key:
        return key
    for env_candidate in (
        Path(__file__).resolve().parent / ".env",
        Path(__file__).resolve().parent.parent / ".env.frontier",
    ):
        if env_candidate.exists():
            try:
                for line in env_candidate.read_text(encoding="utf-8", errors="ignore").splitlines():
                    s = line.strip()
                    if s.startswith("GEMINI_API_KEY="):
                        return s.split("=", 1)[1].strip().strip('"').strip("'")
            except Exception:
                pass
    return ""


def _load_llm_key_pool() -> List[Dict[str, str]]:
    pool_path = Path(__file__).resolve().parent / "data" / "llm_key_pool.json"
    if not pool_path.exists():
        return []
    try:
        raw = json.loads(pool_path.read_text(encoding="utf-8"))
        eps = raw.get("endpoints") if isinstance(raw, dict) else []
        out: List[Dict[str, str]] = []
        for ep in eps or []:
            if isinstance(ep, dict) and ep.get("key") and ep.get("url") and ep.get("model"):
                out.append({
                    "provider": str(ep.get("provider", "openai_compat")),
                    "name": str(ep.get("name", "groq")),
                    "key": str(ep["key"]),
                    "model": str(ep["model"]),
                    "url": str(ep["url"]),
                })
        return out
    except Exception:
        return []


def detect_message_language(text: str) -> str:
    s = str(text or "").strip()
    low = s.lower()
    if _ARABIC_RE.search(s):
        return "ar"
    if _CYRILLIC_RE.search(s):
        return "ru"
    if "ə" in low:
        return "az"
    if _TR_CHARS_RE.search(s):
        return "tr"

    words = set(re.findall(r"[a-záéíóúñüäößçğı]+", low))
    if words & {"salam", "nece", "necesen", "men", "harada", "qardas", "baci"}:
        return "az"
    if words & {
        "selam", "merhaba", "nasil", "nerede", "neredeyim", "halay", "halaya", "ben", "abi",
        "kral", "katil", "kostum", "begeni", "kim", "neden", "var", "mi", "mu", "selamun", "aleykum", "kolay", "gelsin"
    }:
        return "tr"
    if words & {"hola", "como", "donde", "estoy", "bailar", "entrar", "puedo", "que", "quien", "gracias", "buenas", "yo", "novia", "novio", "chica", "chico"} or "¿" in s or "¡" in s:
        return "es"
    if words & {"wie", "wo", "hallo", "kann", "ich", "tanzen", "mitmachen", "warum", "danke", "guten", "frau", "mann"}:
        return "de"
    if words & {"bonjour", "salut", "comment", "rejoindre", "danser", "je", "suis", "merci", "pourquoi", "moi", "fille", "garcon", "garçon"}:
        return "fr"
    if re.match(r"^(?:me+|hi+|hey+|hello+)$", low):
        return "en"
    if words & {
        "how", "where", "what", "why", "who", "when", "which", "can", "could", "would", "should",
        "join", "dance", "dancing", "bugs", "bug", "hello", "hi", "hey", "am", "is", "are", "was",
        "the", "this", "that", "these", "those", "you", "your", "we", "they", "it", "in", "on", "my",
        "name", "outfit", "dress", "game", "play", "cool", "nice", "good", "great", "funny", "hilarious",
        "love", "like", "music", "song", "wow", "omg", "lol", "haha", "bro", "man", "yes", "very", "so",
        "me", "girl", "boy", "plz", "please", "bride", "groom"
    }:
        return "en"
    return "tr"


_FALLBACK_POOL: Dict[str, List[str]] = {
    "tr": [
        "Hoş geldin {nick}! Halay çemberi {dancers} kişiyle dönüyor, gelin ve damat tarafı sahnede omuz omuza! 🕺",
        "Selam {nick}! Mendil elde, kır düğününde davul zurna ritmi yükselmeye devam ediyor! 🔥",
        "Oo {nick} gelmiş! Sahne ışıklarının altında tüm halay ekibi müthiş bir uyum yakaladı! 💃",
        "Vay {nick}! Kır düğününde eğlence tam gaz, şehirler arası tatlı bir rekabet sürüyor! 🎺",
        "Hoş geldin {nick}! Sağdıç tempo verdi, sahnedeki kalabalık {dancers} dansçıya ulaştı! ✨",
        "{nick} meydana uğradı! Gelinle damat pistin ortasında dönerken atmosfer giderek ısınıyor! 👰",
        "Eyvallah {nick}! Horon, zeybek ve halay ezgileriyle kır düğünü akşamı renklendi! 🧣",
        "Bakıyorum keyifler yerinde {nick}! Meydan ekibi {dancers} halaycıyla omuz omuza! 🥁",
        "Hoş geldin {nick}! Kız evi ile damat evi pistin iki yanında ritmi tutuyor! 🎉",
        "Tam zamanında geldin {nick}! Sahne sıcacık, DJ kabininde hareketli ezgiler çalıyor! 🚀",
    ],
    "ru": [
        "Привет, {nick}! На танцполе уже {dancers} участников, праздничный круг кружится вовсю! 💃",
        "Добро пожаловать, {nick}! Свадебная музыка и барабаны создают отличное настроение в зале! 🕺",
        "Ого, {nick} с нами! Невеста и жених уже танцуют в самом центре зелёной поляны! 🔥",
        "Привет, {nick}! Тут настоящий живой праздник с тёплой атмосферой и весельем! 🎺",
        "Салют, {nick}! Нарядные костюмы и зажигательные ритмы не дают устоять на месте! ✨",
        "Рады видеть, {nick}! Сторона невесты и сторона жениха соревнуются в самом разгаре! 🎉",
        "Вечер добрый, {nick}! Круг халая стал ещё дружнее — сейчас на сцене {dancers} танцоров! 🚀",
        "Эй, {nick}, проходи ближе к сцене, сегодня звучит отличная праздничная музыка! 🥁",
    ],
    "en": [
        "Welcome {nick}! {dancers} dancers are spinning on the wedding floor right now! 💃",
        "Hey {nick}! The drums are echoing across the garden as everyone dances in sync! 🕺",
        "Good vibes {nick}! Bride squad and Groom squad are lighting up the dance ring live! 🔥",
        "Glad you made it {nick}! The live 3D folk circle is rolling with warm music and cheers! ✨",
        "Yo {nick}! Live music keeps flowing on the square alongside {dancers} dancers on stage! 🎺",
        "Right on time {nick}! Enjoy the colorful wedding parade spinning across the arena! 🎉",
    ],
    "ar": [
        "أهلاً {nick}! الساحة متألقة الآن بحضور {dancers} راقصاً على أنغام الفرح! 🕺",
        "مرحباً {nick}! العروس والعريس وسط الحلقة والأجواء الاحتفالية مستمرة بحماس! 💃",
        "حياك الله {nick}! فريق العروس وفريق العريس يتنافسان بروح مرحة على المسرح! 🔥",
        "نورت البث يا {nick}! أجواء الفرح والموسيقى المباشرة مستمرة مع الجميع الآن! ✨",
    ],
    "es": [
        "¡Hola {nick}! Ya hay {dancers} bailando en el círculo de boda en vivo! 💃",
        "¡Bienvenido {nick}! La fiesta sigue con ritmo alegre en toda la pista! 🔥",
    ],
    "de": [
        "Hallo {nick}! Schon {dancers} Tänzer drehen fröhlich im Hochzeitskreis! 🕺",
        "Willkommen {nick}! Braut-Team und Bräutigam-Team feiern gemeinsam auf der Bühne! 🔥",
    ],
    "fr": [
        "Salut {nick} ! Déjà {dancers} danseurs en piste dans cette belle ambiance ! 💃",
        "Bienvenue {nick} ! L'atmosphère du mariage bat son plein en direct sur scène ! 🔥",
    ],
    "az": [
        "Xoş gəldin {nick}! Meydanda {dancers} rəqqas birlikdə gözəl halay çəkir! 🕺",
        "Salam {nick}! Qız evi və bəy evi meydanda əyləncəni qızışdırır! 🔥",
    ],
}
_LAST_FALLBACK_IDX: Dict[str, int] = {}


def build_fallback_reply(lang: str, nickname: str, text: str, joined: bool, rem_likes: int, dancers: int = 0) -> str:
    use_lang = lang if lang in _FALLBACK_POOL else "tr"
    pool = _FALLBACK_POOL[use_lang]
    prev = _LAST_FALLBACK_IDX.get(use_lang, -1)
    idx = (prev + 1) % len(pool)
    if len(pool) > 1 and prev >= 0:
        cand = [i for i in range(len(pool)) if i != prev]
        idx = random.choice(cand)
    _LAST_FALLBACK_IDX[use_lang] = idx
    return pool[idx].format(nick=nickname or "Misafir", dancers=max(1, int(dancers or 1)))


class MultilingualAIHost:
    """Multilingual AI Live DJ, Language-Matched Chat Responder & 2-Minute Auto-Command Broadcaster."""

    def __init__(self, broadcast_fn: BroadcastFn, send_chat_fn: SendChatFn) -> None:
        self.broadcast_fn = broadcast_fn
        self.send_chat_fn = send_chat_fn
        self.api_key: str = _load_gemini_api_key()
        self.enabled: bool = True
        self.voice_enabled: bool = True
        self.periodic_enabled: bool = True
        self.auto_chat_enabled: bool = False
        self.interval_sec: int = 210
        self.global_cooldown_sec: float = 12.0
        self.user_cooldown_sec: float = 60.0

        self._last_global_reply_ts: float = 0.0
        self._last_vip_voice_ts: float = 0.0
        self._llm_backoff_until: float = 0.0
        self._gemini_backoff_until: float = 0.0
        self._llm_pool: List[Dict[str, str]] = _load_llm_key_pool()
        self._pool_idx: int = 0
        self._endpoint_backoff: Dict[int, float] = {}
        self._user_last_ts: Dict[str, float] = {}
        self._recent_langs: deque[str] = deque(maxlen=24)
        self._chat_memory: deque[str] = deque(maxlen=8)
        self._tts_cache: OrderedDict[str, bytes] = OrderedDict()
        self._history: deque[Dict[str, Any]] = deque(maxlen=35)
        self._periodic_idx: int = 0
        self._periodic_task: Optional[asyncio.Task] = None
        self._reply_lock = asyncio.Lock()
        self._http: Optional[httpx.AsyncClient] = None
        self.room_snapshot_fn: Optional[Callable[[], Dict[str, Any]]] = None

    async def start(self) -> None:
        if self._http is None:
            self._http = httpx.AsyncClient(timeout=4.8)
        if self._periodic_task is None or self._periodic_task.done():
            self._periodic_task = asyncio.create_task(self._periodic_announcement_loop())
        logger.info("MultilingualAIHost active (LLM=%s, pool=%d, interval=%ss)", bool(self.api_key or self._llm_pool), len(self._llm_pool), self.interval_sec)

    async def stop(self) -> None:
        if self._periodic_task and not self._periodic_task.done():
            self._periodic_task.cancel()
        if self._http is not None:
            await self._http.aclose()
            self._http = None

    def get_tts_audio(self, clip_id: str) -> Optional[bytes]:
        return self._tts_cache.get(clip_id)

    def get_state(self) -> Dict[str, Any]:
        return {
            "enabled": self.enabled,
            "voice_enabled": self.voice_enabled,
            "periodic_enabled": self.periodic_enabled,
            "interval_sec": self.interval_sec,
            "llm_ready": bool(self.api_key or self._llm_pool),
            "model": self._llm_pool[0]["model"] if self._llm_pool else "gemini-3.1-flash-lite-preview",
            "pool_size": len(self._llm_pool),
            "history": list(self._history)[:16],
        }

    def update_options(self, opts: Dict[str, Any]) -> Dict[str, Any]:
        if "enabled" in opts:
            self.enabled = bool(opts["enabled"])
        if "voice_enabled" in opts:
            self.voice_enabled = bool(opts["voice_enabled"])
        if "periodic_enabled" in opts:
            self.periodic_enabled = bool(opts["periodic_enabled"])
        if "interval_sec" in opts:
            self.interval_sec = max(45, min(600, int(opts["interval_sec"])))
        return self.get_state()

    def _should_engage(self, uid: str, text: str) -> bool:
        if not self.enabled:
            return False
        s = text.strip()
        if len(s) < 2 or s in ("1", "2", "11", "22") or s.startswith(("!", "/")):
            return False
        if not any(ch.isalpha() for ch in s):
            return False
        now = time.monotonic()
        if now - self._last_global_reply_ts < self.global_cooldown_sec:
            return False
        if now - self._user_last_ts.get(uid, 0.0) < self.user_cooldown_sec:
            return False
        return True

    async def _synthesize_tts(self, lang: str, text: str) -> str:
        if not self.voice_enabled:
            return ""
        meta = LANG_META.get(lang, LANG_META["tr"])
        scrubbed = _SOLICITATION_BAN_RE.sub(" ", str(text or ""))
        scrubbed = _TTS_ITEM_SCRUB_RE.sub(" ", scrubbed)
        clean_speech = re.sub(r"[^\w\s.,!?¡¿'\"-]", " ", scrubbed, flags=re.UNICODE)
        clean_speech = re.sub(r"\s+", " ", clean_speech).strip()[:165]
        if not clean_speech:
            return ""
        # Avoid pitch-shifting in Edge-TTS; WSOLA pitch shifts introduce metallic/robotic artifacts.
        natural_rate = random.choice(["+2%", "+4%", "+6%"])
        attempts = [
            {"rate": natural_rate},
            {"rate": "+0%"},
        ]
        for attempt_idx, kwargs in enumerate(attempts):
            try:
                comm = edge_tts.Communicate(clean_speech, voice=meta["voice"], **kwargs)
                buf = bytearray()
                async def _collect_tts() -> None:
                    async for chunk in comm.stream():
                        if chunk["type"] == "audio":
                            buf.extend(chunk["data"])
                await asyncio.wait_for(_collect_tts(), timeout=8.0)
                if buf:
                    cid = uuid.uuid4().hex[:12]
                    self._tts_cache[cid] = bytes(buf)
                    while len(self._tts_cache) > 40:
                        self._tts_cache.popitem(last=False)
                    return f"/api/tts/{cid}.mp3"
            except Exception as exc:
                logger.debug("Edge-TTS warning (%s attempt=%d): %s", lang, attempt_idx + 1, exc)
            if attempt_idx == 0:
                await asyncio.sleep(0.3)
        return ""

    async def _query_llm(self, lang: str, nickname: str, comment: str, joined: bool, rem_likes: int, dancers: int, leader: str) -> str:
        if not (self.api_key or self._llm_pool) or time.monotonic() < self._llm_backoff_until:
            return build_fallback_reply(lang, nickname, comment, joined, rem_likes, dancers)
        if self._http is None:
            self._http = httpx.AsyncClient(timeout=4.8)

        lang_name = LANG_META.get(lang, LANG_META["tr"])["name"]
        status_hint = "dancing in the 3D Halay circle" if joined else "hanging out in the wedding square"
        recent_ctx = "\n".join(self._chat_memory) if self._chat_memory else "(no prior turns yet)"
        prompt = (
            f"You are the witty, warm, natural co-host ('Meydan DJ') of a live 3D dancing cockroach Halay wedding stream on TikTok.\n"
            f"Recent chat memory:\n{recent_ctx}\n\n"
            f"Now viewer '{nickname}' ({status_hint}) says: \"{comment}\"\n"
            f"Room context (use ONLY if relevant): {dancers} dancers on stage, Halaybaşı (leader): {leader or 'Meydan'}.\n"
            f"Interactive chat commands (mention naturally if relevant): '1' = girl outfit / Bride team, '2' = boy outfit / Groom team, '34/06/21' = city race, '!oy A/B/C' = vote next venue or stage FX, '!istek song' = VIP DJ song booth.\n"
            f"STRICT RULES:\n"
            f"1. Actually CHAT and react naturally with warm wedding humor to what '{nickname}' just said (greetings, jokes, questions, compliments, city plates, vibe).\n"
            f"2. Reply 100% in the EXACT language of \"{comment}\" (rough hint: {lang_name}, override if message is clearly another language!).\n"
            f"3. Keep it punchy: max 18 words, warm & playful, address '{nickname}', max 2 emojis.\n"
            f"4. NEVER mention gift names, item names, or solicitation words (Donut, Parfüm, Çay, Taç, Kalp, Galaksi, Gül, gift, gifts, hediye, ödül, coin, jeton, diamond, elmas, like, beğeni, tap, донат, подарок, духи, пончик, عطر, دونات) because the visual HUD already displays items.\n"
            f"Output ONLY the reply:"
        )

        # 1. Try 13-key Groq LPU pool first (650 tok/s, round-robin + per-key 429 backoff across up to 8 keys)
        if self._llm_pool:
            now_mono = time.monotonic()
            pool_len = len(self._llm_pool)
            for offset in range(min(pool_len, 8)):
                idx = (self._pool_idx + offset) % pool_len
                if now_mono < self._endpoint_backoff.get(idx, 0.0):
                    continue
                ep = self._llm_pool[idx]
                try:
                    r = await self._http.post(
                        ep["url"],
                        headers={"Authorization": f"Bearer {ep['key']}"},
                        json={
                            "model": ep["model"],
                            "messages": [{"role": "user", "content": prompt}],
                            "max_tokens": 110,
                            "temperature": 0.82,
                        },
                    )
                    if r.status_code in (429, 503):
                        self._endpoint_backoff[idx] = time.monotonic() + 60.0
                        continue
                    if r.status_code == 200:
                        self._pool_idx = (idx + 1) % pool_len
                        choices = r.json().get("choices") or []
                        if choices:
                            raw_out = str((choices[0].get("message") or {}).get("content", ""))
                            raw_out = re.sub(r"<think>.*?</think>", " ", raw_out, flags=re.S)
                            raw_out = re.sub(r"\s+", " ", raw_out).strip().strip('"').strip("'")
                            if (
                                len(raw_out) >= 8
                                and not _SOLICITATION_BAN_RE.search(raw_out)
                                and not _TTS_ITEM_SCRUB_RE.search(raw_out)
                            ):
                                return raw_out[:145]
                except Exception as exc:
                    logger.debug("Groq pool[%d] fallback: %s", idx, exc)

        model_pool = (
            "gemini-3.1-flash-lite-preview",
            "gemini-3-flash-preview",
        )
        if not hasattr(self, "_model_backoff"):
            self._model_backoff: Dict[str, float] = {}
        now_mono = time.monotonic()
        if not self.api_key or now_mono < self._gemini_backoff_until:
            return build_fallback_reply(lang, nickname, comment, joined, rem_likes, dancers)
        eligible_models = [m for m in model_pool if now_mono >= self._model_backoff.get(m, 0.0)]
        if not eligible_models:
            return build_fallback_reply(lang, nickname, comment, joined, rem_likes, dancers)

        for model in eligible_models:
            gen_cfg: Dict[str, Any] = {"maxOutputTokens": 110, "temperature": 0.82}
            if model == "gemini-3.1-flash-lite-preview":
                gen_cfg["thinkingConfig"] = {"thinkingBudget": 0}
            try:
                resp = await self._http.post(
                    f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
                    headers={"x-goog-api-key": self.api_key},
                    json={
                        "contents": [{"parts": [{"text": prompt}]}],
                        "generationConfig": gen_cfg,
                    },
                )
                if resp.status_code == 400 and "thinkingConfig" in gen_cfg:
                    gen_cfg.pop("thinkingConfig", None)
                    resp = await self._http.post(
                        f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
                        headers={"x-goog-api-key": self.api_key},
                        json={"contents": [{"parts": [{"text": prompt}]}], "generationConfig": gen_cfg},
                    )
                if resp.status_code == 404:
                    self._model_backoff[model] = time.monotonic() + 86400.0
                    continue
                if resp.status_code in (429, 503):
                    cooldown_until = time.monotonic() + 1800.0
                    self._gemini_backoff_until = cooldown_until
                    self._model_backoff[model] = cooldown_until
                    logger.info("Gemini %s rate-limited (%s); pausing Gemini fallback for 30m.", model, resp.status_code)
                    break
                if resp.status_code == 200:
                    cands = resp.json().get("candidates") or []
                    if cands:
                        parts = (cands[0].get("content") or {}).get("parts") or []
                        raw_out = "".join(str(p.get("text", "")) for p in parts).strip().strip('"').strip("'")
                        raw_out = re.sub(r"\s+", " ", raw_out)
                        if (
                            len(raw_out) >= 8
                            and not _SOLICITATION_BAN_RE.search(raw_out)
                            and not _TTS_ITEM_SCRUB_RE.search(raw_out)
                        ):
                            return raw_out[:145]
            except Exception as exc:
                logger.debug("LLM %s fallback: %s", model, exc)

        return build_fallback_reply(lang, nickname, comment, joined, rem_likes, dancers)

    async def on_viewer_chat(
        self,
        user: Dict[str, Any],
        clean_text: str,
        joined: bool,
        rem_likes: int,
        dancers: int,
        leader: str,
        force: bool = False,
    ) -> Optional[Dict[str, Any]]:
        uid = str(user.get("uid") or "guest")
        lang = detect_message_language(clean_text)
        self._recent_langs.append(lang)

        if not force and not self._should_engage(uid, clean_text):
            return None
        if self._reply_lock.locked() and not force:
            return None

        async with self._reply_lock:
            now = time.monotonic()
            self._last_global_reply_ts = now
            self._user_last_ts[uid] = now

            nick = str(user.get("nickname") or uid)[:20]
            reply_text = await self._query_llm(lang, nick, clean_text, joined, rem_likes, dancers, leader)
            self._chat_memory.append(f"{nick}: {clean_text[:60]} -> AI: {reply_text[:80]}")
            tts_url = await self._synthesize_tts(lang, reply_text)
            chat_sent = await self.send_chat_fn(f"@{nick} {reply_text}"[:148]) if self.auto_chat_enabled else False

            meta = LANG_META.get(lang, LANG_META["tr"])
            event = {
                "type": "ai_host",
                "kind": "reply",
                "lang": lang,
                "flag": meta["flag"],
                "lang_label": meta["label"],
                "user": user,
                "question": clean_text[:60],
                "text": reply_text,
                "tts_url": tts_url,
                "chat_sent": chat_sent,
                "ts": time.time(),
            }
            self._history.appendleft(event)
            await self.broadcast_fn(event)
            return event

    def _build_periodic_notice(self) -> tuple[str, str, str]:
        snap = self.room_snapshot_fn() if self.room_snapshot_fn else {}
        dancers = int(snap.get("dancers", 0) or 0)
        leader = str(snap.get("leader") or "Meydan")
        round_no = int(snap.get("round_number", 1) or 1)
        roles = snap.get("roles") or {}
        lang_scores = snap.get("lang_scores") or {}

        empty_tr = []
        if not roles.get("halaybasi"):
            empty_tr.append("Halaybaşı tahtı")
        if not roles.get("gelin"):
            empty_tr.append("Gelin koltuğu")
        if not roles.get("damat"):
            empty_tr.append("Damat koltuğu")
        if not roles.get("davulcu"):
            empty_tr.append("Davulcu")
        if not roles.get("zurnaci"):
            empty_tr.append("Zurnacı")

        seat_tr = (
            f"👑 Sahnede {', '.join(empty_tr[:3])} şu an boş ve sahibini bekliyor!"
            if empty_tr
            else f"👑 Meydanda tüm özel koltuklar dolu, Halaybaşı {leader} liderliği sürdürüyor!"
        )

        tr_templates = [
            f"{seat_tr} Sahne ışıklarının altında halay ve düğün coşkusu devam ediyor!",
            f"🕺 {round_no}. Düğün turunda {dancers} halaycı pistte! Şehirler ve taraflar arası rekabet kızışıyor!",
            "🗳️ Canlı '!oy A', '!oy B' veya '!oy C' anketleriyle sahnenin sıradaki mekanını ve efektini seçebilirsiniz!",
            "👰 Gelin tarafı ile Damat tarafı kır düğününde ritmi tutmaya devam ediyor!",
            "🎧 Canlı DJ kabininde yerli ve uluslararası düğün ezgileri arka arkaya çalıyor!",
        ]
        intl_templates = {
            "en": "🌍 EN: Welcome to the live garden wedding arena! Enjoy the folk circle & international DJ mix!",
            "ru": "🌍 RU: Добро пожаловать на живую свадьбу! Наслаждайтесь танцами и музыкой на сцене!",
            "ar": "🌍 AR: أهلاً بكم في ساحة الزفاف المباشرة! استمتعوا بالرقص والموسيقى المتنوعة!",
            "es": "🌍 ES: ¡Bienvenidos a la fiesta de boda en vivo! ¡Música y baile internacional en la pista!",
            "de": "🌍 DE: Willkommen in der Live-Hochzeitsarena! Genießt die Musik und die Tanzrunde!",
            "fr": "🌍 FR: Bienvenue au mariage en direct ! Profitez de la musique et du cercle de danse !",
            "az": "🌍 AZ: Canlı toy meydanına xoş gəlmisiniz! Musiqi və halay coşqusu davam edir!",
        }

        ranked_intl = [
            lg for lg, _ in sorted(lang_scores.items(), key=lambda x: x[1], reverse=True)
            if lg in intl_templates
        ]
        for lg in list(self._recent_langs) + ["ru", "en", "ar"]:
            if lg in intl_templates and lg not in ranked_intl:
                ranked_intl.append(lg)

        cycle: List[tuple[str, str, str]] = []
        for i, tr_msg in enumerate(tr_templates):
            tr_speech = _TTS_ITEM_SCRUB_RE.sub(" ", tr_msg)
            tr_speech = re.sub(r"\s+", " ", tr_speech).strip()
            cycle.append(("tr", tr_msg, tr_speech))
            lg = ranked_intl[i % len(ranked_intl)]
            imsg = intl_templates[lg]
            ispeech = re.sub(r"^🌍\s*[A-Z]{2}:\s*", "", imsg)
            ispeech = _TTS_ITEM_SCRUB_RE.sub(" ", ispeech)
            ispeech = re.sub(r"\s+", " ", ispeech).strip()
            cycle.append((lg, imsg, ispeech))

        idx = self._periodic_idx
        self._periodic_idx += 1
        return cycle[idx % len(cycle)]

    def _build_vip_role_line(self, lang: str, nick: str, role: str, item_name: str) -> str:
        # Never pronounce gift/item names in spoken TTS or automated role callouts
        if lang == "ru":
            return {
                "halaybasi": f"👑 Браво, {nick}! Новый Лидер круга вышел вперёд на сцену!",
                "gelin": f"👰 {nick} выбрана Невестой вечера на всей сцене!",
                "damat": f"🤵 {nick} выбран Женихом вечера под аплодисменты!",
                "zurnaci": f"🎺 {nick} стал главным Маэстро сцены! Какой ритм!",
                "davulcu": f"🥁 {nick} занял место Барабанщика и открыл пульт DJ!",
                "dj_play": f"🎧 Диджей дня {nick} ставит заказанный трек, зажигаем на весь зал!",
                "dj_lock": f"🎧 @{nick}, пульт диджея открыт для чемпионов Барабана и Лидера сцены!",
                "round_winner": f"🏆 Поздравляем {nick} с победой в раунде! Новая свадьба начинается!",
            }.get(role, f"👑 {nick} теперь в главном составе сцены!")
        if lang == "en":
            return {
                "halaybasi": f"👑 Shoutout to {nick}! Crowned the new Stage King on the floor!",
                "gelin": f"👰 {nick} just claimed the Wedding Bride seat on stage!",
                "damat": f"🤵 {nick} just claimed the Wedding Groom seat! Huge cheers!",
                "zurnaci": f"🎺 {nick} is our new Stage Maestro! Turn up the tempo!",
                "davulcu": f"🥁 {nick} took the Drummer spot and unlocked VIP DJ song control!",
                "dj_play": f"🎧 DJ {nick} is spinning a custom track on stage right now!",
                "dj_lock": f"🎧 @{nick}, the DJ booth opens for Drummer and Stage King champions!",
                "round_winner": f"🏆 {nick} wins the Wedding Round! Brand new round starts right now!",
            }.get(role, f"👑 {nick} unlocked a spotlight role on stage!")
        if lang == "ar":
            return {
                "halaybasi": f"👑 تحية كبيرة لـ {nick}! توج ملك الساحة الآن!",
                "gelin": f"👰 {nick} أصبحت عروس الحفل على الساحة!",
                "damat": f"🤵 {nick} أصبح عريس الحفل وسط تصفيق الجميع!",
                "zurnaci": f"🎺 {nick} أصبح عازف الساحة الرئيسي!",
                "davulcu": f"🥁 {nick} أصبح الطبال وفتح تحكم الدي جي!",
                "dj_play": f"🎧 {nick} يشغّل الآن مقطعه الموسيقي المختار على المسرح!",
                "dj_lock": f"🎧 @{nick} منصة الدي جي مفتوحة لأبطال الساحة الآن!",
                "round_winner": f"🏆 مبروك {nick} الفوز بالجولة! جولة جديدة تبدأ الآن!",
            }.get(role, f"👑 {nick} حصل على دور مميز في الساحة!")
        return {
            "halaybasi": f"👑 Alkışlar {nick} için! Yeni Halaybaşı oldu ve halayın başına geçti!",
            "gelin": f"👰 Düğünün yeni Gelini {nick} oldu! Meydan yıkılıyor!",
            "damat": f"🤵 Düğünün yeni Damadı {nick} sahnede! Çifte alkışlar!",
            "zurnaci": f"🎺 {nick} meydan Zurnacısı oldu! Tempo ve coşku tavan!",
            "davulcu": f"🥁 {nick} Davulcu koltuğuna geçti ve VIP DJ istek sırasını açtı!",
            "dj_play": f"🎧 Kabinde {nick} rüzgarı! İstediği parça şimdi sahnede çalıyor!",
            "dj_lock": f"🎧 @{nick}, '!istek şarkı' DJ kabini Davulcu ve Halaybaşı koltuğu sahiplerine açık!",
            "round_winner": f"🏆 Düğün turunun şampiyonu {nick}! Yeni düğün turu şimdi başlıyor!",
        }.get(role, f"👑 {nick} sahnede özel rol aldı!")

    async def announce_vip_event(
        self,
        user: Dict[str, Any],
        role: str,
        item_name: str = "",
        diamonds: int = 0,
        lang: str = "tr",
    ) -> Optional[Dict[str, Any]]:
        use_lang = lang if lang in LANG_META else "tr"
        now = time.monotonic()
        min_gap = 2.5 if role in ("halaybasi", "gelin", "damat", "round_winner") else 6.0
        if now - self._last_vip_voice_ts < min_gap:
            return None
        self._last_vip_voice_ts = now

        nick = str(user.get("nickname") or user.get("uid") or "Şampiyon")[:20]
        msg = self._build_vip_role_line(use_lang, nick, role, item_name)
        if role == "round_winner" and "|" in str(item_name or ""):
            parts = str(item_name).split("|")
            if len(parts) >= 3 and use_lang in ("tr", "az"):
                try:
                    streak_d = int(parts[1])
                    wins_c = int(parts[2])
                    if wins_c >= 2 or streak_d >= 2:
                        msg = f"🏆 {nick} tam {wins_c}. tur şampiyonluğunu aldı! {streak_d} günlük serisiyle meydanı sallıyor!"
                except Exception:
                    pass
        if _SOLICITATION_BAN_RE.search(msg):
            msg = self._build_vip_role_line("tr", nick, role, "Donut")
        if _SOLICITATION_BAN_RE.search(msg):
            return None

        tts_url = await self._synthesize_tts(use_lang, msg)
        meta = LANG_META.get(use_lang, LANG_META["tr"])
        event = {
            "type": "ai_host",
            "kind": f"vip_{role}",
            "lang": use_lang,
            "flag": meta["flag"],
            "lang_label": meta["label"],
            "user": user,
            "question": f"👑 {role.upper()}",
            "text": msg,
            "tts_url": tts_url,
            "chat_sent": False,
            "ts": time.time(),
        }
        self._history.appendleft(event)
        await self.broadcast_fn(event)
        return event

    async def on_stage_broadcast(self, payload: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Synthesize concise anti-ban TTS announcements for polls, stage shows, takeovers & atmosphere shifts."""
        if not self.enabled or not self.voice_enabled or not isinstance(payload, dict):
            return None
        ptype = str(payload.get("type") or "")
        now = time.monotonic()
        last_stage_ts = getattr(self, "_last_stage_voice_ts", 0.0)
        if now - last_stage_ts < 4.5:
            return None

        text = ""
        question = "🎭 Sahne Anonsu"
        if ptype == "audience_poll":
            act = str(payload.get("action") or "")
            if act == "open":
                text = "Canlı oylama başladı! Sohbete ünlem oy A, B veya C yazarak sahne ve mekan seçimini yap!"
                question = "🗳️ Canlı Anket"
            elif act == "close" and isinstance(payload.get("winner"), dict):
                w_name = str(payload["winner"].get("name") or payload["winner"].get("key") or "Kazanan")[:32]
                text = f"Oylama tamamlandı! Kazanan {w_name} sahnede başlıyor!"
                question = "🏆 Anket Sonucu"
        elif ptype == "scheduled_event" and payload.get("action") == "start":
            ev = payload.get("event") if isinstance(payload.get("event"), dict) else {}
            ev_name = str(ev.get("name") or "Sahne Şovu")[:36]
            text = f"{ev_name} sahnede başladı! Meydan coşkusu yükseliyor!"
            question = f"{ev.get('icon', '⚡')} {ev_name}"
        elif ptype == "mega_party_burst":
            patron = payload.get("patron") if isinstance(payload.get("patron"), dict) else {}
            nick = str(patron.get("nickname") or "Meydan")[:20]
            text = f"Parti patronu {nick} sahneyi yaktı! Kırk beş saniyelik mega şölen başladı!"
            question = "🪩 Mega Şölen"
        elif ptype == "country_takeover":
            c_code = str(payload.get("country") or "TR").upper()[:6]
            text = f"{c_code} ekibi sahneyi ele geçirdi! Meydanda tatlı rekabet kızışıyor!"
            question = f"🏴 {c_code}"
        elif ptype == "director_control" and payload.get("atmosphere") in ("day", "sunset", "night", "snow", "rain"):
            atmo = str(payload["atmosphere"])
            prev_atmo = getattr(self, "_last_announced_atmo", "day")
            if atmo == prev_atmo:
                return None
            self._last_announced_atmo = atmo
            atmo_labels = {
                "day": "Gündüz Kır Düğünü",
                "sunset": "Altın Gün Batımı Sahili",
                "night": "Gece Neon Festivali",
                "snow": "Karlı Dağ Düğünü",
                "rain": "Yağmurlu Gece Meydanı",
            }
            text = f"Sahne atmosferi {atmo_labels.get(atmo, atmo)} moduna geçti! Meydan yenilendi!"
            question = "🎬 Sahne Atmosferi"

        if not text or _SOLICITATION_BAN_RE.search(text):
            return None
        self._last_stage_voice_ts = now
        tts_url = await self._synthesize_tts("tr", text)
        meta = LANG_META["tr"]
        event = {
            "type": "ai_host",
            "kind": f"stage_{ptype}",
            "lang": "tr",
            "flag": meta["flag"],
            "lang_label": meta["label"],
            "user": {"uid": "ai_dj", "nickname": "Meydan DJ 🎧", "avatar": ""},
            "question": question,
            "text": text,
            "tts_url": tts_url,
            "chat_sent": False,
            "ts": time.time(),
        }
        self._history.appendleft(event)
        await self.broadcast_fn(event)
        return event

    async def send_manual_chat(self, text: str, lang: str = "tr", speak: bool = True) -> Dict[str, Any]:
        """Send a host/bot message directly to TikTok LIVE chat (when sessionid is active) and show on stage."""
        use_lang = lang if lang in LANG_META else detect_message_language(text)
        raw = str(text or "").strip()
        scrubbed = _SOLICITATION_BAN_RE.sub(" ", raw)
        scrubbed = _TTS_ITEM_SCRUB_RE.sub(" ", scrubbed)
        clean_text = re.sub(r"\s+", " ", scrubbed).strip()[:148]
        if not clean_text:
            return {"ok": False, "error": "Empty message after safety filter"}

        delivered = await self.send_chat_fn(clean_text)
        tts_url = await self._synthesize_tts(use_lang, clean_text) if speak else ""
        meta = LANG_META.get(use_lang, LANG_META["tr"])
        event = {
            "type": "ai_host",
            "kind": "host_chat",
            "lang": use_lang,
            "flag": meta["flag"],
            "lang_label": meta["label"],
            "user": {"uid": "host_bot", "nickname": "Yayıncı Bot 💬", "avatar": ""},
            "question": "💬 Yayıncı Mesajı",
            "text": clean_text,
            "tts_url": tts_url,
            "chat_sent": delivered,
            "sent_to_tiktok": delivered,
            "ts": time.time(),
        }
        self._history.appendleft(event)
        await self.broadcast_fn(event)
        return {"ok": True, "text": clean_text, "delivered_to_tiktok": delivered, "event": event}

    async def trigger_periodic_now(self) -> Dict[str, Any]:
        lang, msg, speech = self._build_periodic_notice()
        tts_url = await self._synthesize_tts(lang, speech)
        chat_sent = await self.send_chat_fn(msg[:148]) if self.auto_chat_enabled else False
        meta = LANG_META.get(lang, LANG_META["tr"])
        event = {
            "type": "ai_host",
            "kind": "periodic",
            "lang": lang,
            "flag": meta["flag"],
            "lang_label": meta["label"],
            "user": {"uid": "ai_dj", "nickname": "Meydan DJ 🎧", "avatar": ""},
            "question": "⏱️ Canlı Yayın Rehberi",
            "text": msg,
            "tts_url": tts_url,
            "chat_sent": chat_sent,
            "ts": time.time(),
        }
        self._history.appendleft(event)
        await self.broadcast_fn(event)
        return event

    async def _periodic_announcement_loop(self) -> None:
        await asyncio.sleep(25.0)
        while True:
            try:
                if self.periodic_enabled:
                    async with self._reply_lock:
                        await self.trigger_periodic_now()
            except asyncio.CancelledError:
                break
            except Exception as exc:
                logger.warning("Periodic AI announcement warning: %s", exc)
            await asyncio.sleep(float(max(45, self.interval_sec)))
