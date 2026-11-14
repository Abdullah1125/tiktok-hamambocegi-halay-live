// Divalar Halay A.S — Minimal Modern TikOyun SDK, 16:9->9:16 Full-HD Supersampling Engine & Smart Gift Conversion Suite v17
(function () {
  "use strict";

  const params = new URLSearchParams(window.location.search);
  const IS_OBS = params.get("obs") === "1" || params.get("dikey") === "1";
  const IS_OBS_STUDIO = params.get("studio") === "obs";
  const NATIVE_DPR = Number(window.devicePixelRatio) || 1;
  const IS_MOBILE = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || "");
  if (IS_OBS) document.documentElement?.classList?.add("obs-clean");
  if (IS_OBS_STUDIO) document.documentElement?.classList?.add("obs-clean", "obs-true-center");

  // 2.0x DPR so 2D canvas textures (3D overhead nameplates, chat bubbles & avatars) rasterize razor-sharp even in 16:9 "Ekrana doldur"
  if (!IS_MOBILE && !IS_OBS && !IS_OBS_STUDIO && NATIVE_DPR < 2.0) {
    try {
      Object.defineProperty(window, "devicePixelRatio", {
        get: () => 2.0,
        configurable: true
      });
    } catch (_) {}
  }

  // Automatic 9:16 Center-Strip Full-HD Lock when TikTok LIVE Studio opens a 16:9 Browser Source with "Ekrana doldur"
  const rawInnerWidthGetter = Object.getOwnPropertyDescriptor(window, "innerWidth")?.get;
  const getRawInnerWidth = () => (rawInnerWidthGetter ? Number(rawInnerWidthGetter.call(window)) : Number(document.documentElement?.clientWidth || 1080));
  let _cachedCropW = 0;
  let _cachedFmt = "dikey";
  function readFmtFromStorage() {
    try {
      const s = JSON.parse(localStorage.getItem("divalar-halay:ayarlar") || "null");
      _cachedFmt = (s && s.format === "yatay") ? "yatay" : "dikey";
    } catch (_) {
      _cachedFmt = "dikey";
    }
  }
  function syncDikeyCropClass(forceSync = false) {
    if (!forceSync && _cachedCropW > 0) {
      return _cachedCropW;
    }
    try {
      readFmtFromStorage();
      const rawW = getRawInnerWidth();
      const rawH = Number(window.innerHeight || 1920);
      const shouldCrop916 = !IS_MOBILE && _cachedFmt === "dikey" && rawW > rawH * 0.65;
      if (document.documentElement?.classList?.contains("dikey-916-crop") !== shouldCrop916) {
        document.documentElement?.classList?.toggle("dikey-916-crop", shouldCrop916);
      }
      _cachedCropW = shouldCrop916 ? Math.min(rawW, Math.round((rawH * 9) / 16)) : rawW;
      return _cachedCropW;
    } catch (_) {
      return getRawInnerWidth();
    }
  }
  if (!IS_MOBILE && rawInnerWidthGetter) {
    try {
      Object.defineProperty(window, "innerWidth", {
        get: () => (_cachedCropW > 0 ? _cachedCropW : syncDikeyCropClass(true)),
        configurable: true
      });
      syncDikeyCropClass(true);
      window.addEventListener("resize", () => syncDikeyCropClass(true));
      window.addEventListener("storage", (e) => {
        if (!e || e.key === "divalar-halay:ayarlar") syncDikeyCropClass(true);
      });
    } catch (_) {}
  }
  const INITIAL_USER = (params.get("user") || localStorage.getItem("divalar:tiktok_user") || "mert.can.yldz2")
    .replace(/^@+/, "")
    .trim();

  const SETTINGS_KEY = "divalar-halay:ayarlar";
  const SCHEMA_KEY = "divalar:rules_schema_v8";

  const G_IMG = {
    gul: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/eba3a9bb85c33e017f3648eaf88d7189~tplv-obj.webp",
    pkalp: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/a4c4dc437fd3a6632aba149769491f49.png~tplv-obj.webp",
    parfum: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/20b8f61246c7b6032777bb81bf4ee055~tplv-obj.webp",
    donat: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/4e7ad6bdf0a1d860c538f38026d4e812~tplv-obj.webp",
    cay: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/c84fe43f3177684b07ad2f13138a852d~tplv-obj.webp",
    aile: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/resource/8821932e2d3fe78e9af0bcf785ca1759.png~tplv-obj.webp",
    ktac: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/cf3db11b94a975417043b53401d0afe1~tplv-obj.webp",
    ekalp: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/47e9081623cdae9faa55f4d0d67908bf~tplv-obj.webp",
    tac: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/3070d46dd3a4ab39c24f094e14996784.png~tplv-obj.webp"
  };

  function buildDefaultRules() {
    return [
      { id: "r-begeni", trigger: "like", action: "katil", likes: 100 },
      { id: "r-pkalp", trigger: "gift", action: "konfeti", gift: { id: 5487, name: "Parmak Kalp", image: G_IMG.pkalp, diamond: 5 } },
      { id: "r-parfum", trigger: "gift", action: "davulcu", gift: { id: 5658, name: "Parfüm", image: G_IMG.parfum, diamond: 20 } },
      { id: "r-donat", trigger: "gift", action: "halaybasi", gift: { id: 5879, name: "Donat", image: G_IMG.donat, diamond: 30 } },
      { id: "r-cay", trigger: "gift", action: "zurnaci", gift: { id: 5303, name: "Çay", image: G_IMG.cay, diamond: 50 } },
      { id: "r-aile", trigger: "gift", action: "konfeti", gift: { id: 11495, name: "Aile", image: G_IMG.aile, diamond: 90 } },
      { id: "r-ktac", trigger: "gift", action: "damat", gift: { id: 6097, name: "Küçük Taç", image: G_IMG.ktac, diamond: 99 } },
      { id: "r-ekalp", trigger: "gift", action: "gelin", gift: { id: 5924, name: "Elle Kalp", image: G_IMG.ekalp, diamond: 100 } },
      { id: "r-para", trigger: "gift", action: "parasac", gift: { id: 5502, name: "Taç", image: G_IMG.tac, diamond: 199 } }
    ];
  }

  // Enforce strict 100-Like / Big-Gift Halay Entry (strips 1-coin Rose & passive join rules)
  function sanitizeHalaySettings(cfg) {
    const base = (cfg && typeof cfg === "object") ? { ...cfg } : {};
    base.version = 4;
    base.camera = base.camera || "sinematik";
    base.format = "dikey";
    if (typeof base.genderSwap !== "boolean") base.genderSwap = true;
    const rawMax = Number(base.maxDancers) || 52;
    base.maxDancers = rawMax > 56 ? 52 : Math.min(56, Math.max(20, rawMax));
    base.paraSeconds = Number(base.paraSeconds) || 5;
    const rawRules = Array.isArray(base.rules) ? base.rules : buildDefaultRules();
    const filtered = rawRules.filter((r) => {
      if (!r || typeof r !== "object") return false;
      if (r.action === "katil" && r.trigger !== "like" && r.trigger !== "gift") return false;
      if (r.trigger === "join") return false;
      if (r.trigger === "gift" && (Number(r.gift?.id) === 5655 || Number(r.gift?.diamond || 0) < 5)) return false;
      return true;
    });
    const likeRule = filtered.find((r) => r.trigger === "like" && r.action === "katil");
    if (likeRule) {
      likeRule.likes = 100;
    } else {
      filtered.unshift({ id: "r-begeni", trigger: "like", action: "katil", likes: 100 });
    }
    base.rules = filtered;
    return base;
  }

  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    const hasSchema = localStorage.getItem(SCHEMA_KEY) === "1";
    const parsed = raw ? JSON.parse(raw) : null;
    const clean = (!parsed || !hasSchema) ? sanitizeHalaySettings(null) : sanitizeHalaySettings(parsed);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(clean));
    localStorage.setItem(SCHEMA_KEY, "1");
  } catch (_) {}

  const listeners = new Map();
  let ws = null;
  let giftCatalogCache = null;
  const giftByName = new Map();
  let seqCounter = 1;
  let likeThreshold = 100;
  const userLikeTotals = new Map();
  const joinedUsers = new Set();
  const viewerProfiles = new Map();

  const sdkState = {
    moduleId: "web-diva",
    gatewayBaseUrl: window.location.origin,
    id: "7636845973330789399",
    secUid: "local_bridge_secuid",
    roomId: "",
    uniqueId: INITIAL_USER,
    tiktokUsername: INITIAL_USER,
    settingsId: "local-divalar-settings",
    packageIsPaid: true,
    hasPackageAccess: true,
    gameMode: "private",
    licenseStatus: "ready",
    wsStatus: "connecting"
  };

  function emit(type, payload) {
    const set = listeners.get(type);
    if (!set) return;
    for (const fn of [...set]) {
      try { fn(payload); } catch (err) { console.warn("[LocalTikOyun]", type, err); }
    }
  }

  function escHtml(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function proxyAvatar(url) {
    if (!url || typeof url !== "string") return null;
    if (url.startsWith("/api/avatar")) return url;
    if (url.startsWith("http://") || url.startsWith("https://")) return "/api/avatar?url=" + encodeURIComponent(url);
    return url;
  }

  // Strip invisible fillers & non-emoji SMP tofu (musical/Brahmi/Bamum/private-use like 𝄃𝄂𝄂𝄀 / 𑣲) while preserving ZWJ (\u200D) & VS16 (\uFE0F) emojis
  const INVIS_NICK_RE = /[\u0000-\u001F\u007F-\u009F\u034F\u061C\u115F\u1160\u17B4\u17B5\u180B-\u180E\u1950-\u197F\u1B00-\u1B7F\u200B\u200C\u200E\u200F\u202A-\u202E\u2060-\u206F\u2800\u3164\uA980-\uA9DF\uFE00-\uFE0E\uFEFF\uFFA0\uFFF0-\uFFFF]+/g;
  const SMP_TOFU_RE = /[\u{10000}-\u{1EEFF}\u{F0000}-\u{10FFFF}]/gu;
  const VISIBLE_NICK_RE = /[\p{L}\p{N}\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/u;

  const UNSAFE_BUBBLE_RE = new RegExp(
    [
      "\\b(amk|aq|amq|oç|oc|orospu|sik|sikeyim|sikerim|siktir|yarrak|yarak|piç|pic|göt|gotveren|kahpe|pezevenk|ibne|amcık|amcik)\\b",
      "(соси|сосите|бля|блят|бляд|сука|хуй|хуя|нахуй|пизд|ебат|ебал|ебан|пидор|педик|шлюх|гандон|мудак|залуп)",
      "\\b(sosite|sosi|blyat|blyad|blat|suka|cyka|hui|huy|nahui|nahuy|naxuy|pizda|pizdec|ebat|yebat|pidor|pidaras|shluha|gandon)\\b",
      "\\b(fuck|fucking|fucker|bitch|dick|cock|pussy|whore|slut|cunt|nigger|nigga|faggot|retard|hitler|nazi|porn|sex)\\b",
      "\\b(putain|salope|connard|encule|merde|hurensohn|fotze|schlampe|wichser)\\b",
      "(https?:\\/\\/|www\\.|t\\.me\\/|discord\\.gg|\\b[a-z0-9-]+\\.(com|ru|net|org|io|gg|xyz|me)\\b)",
      "(^|\\s)@[a-z0-9_.]{3,}",
      "(\\+?\\d[\\d\\s\\-()]{8,}\\d)"
    ].join("|"),
    "iu"
  );

  function isSafeBubbleText(text) {
    const clean = String(text ?? "").trim();
    if (!clean) return false;
    let norm = clean;
    try { norm = norm.normalize("NFKC"); } catch (_) {}
    if (UNSAFE_BUBBLE_RE.test(norm)) return false;
    const stripped = norm.replace(SMP_TOFU_RE, "").replace(INVIS_NICK_RE, "").trim();
    return Boolean(stripped);
  }

  function sliceCodePoints(str, maxLen) {
    const arr = Array.from(String(str ?? ""));
    return arr.length > maxLen ? arr.slice(0, maxLen).join("") : arr.join("");
  }

  function cleanDisplayNick(rawNick, fallbackUid) {
    let norm = String(rawNick ?? "");
    try { norm = norm.normalize("NFKC"); } catch (_) {}
    const stripped = norm
      .replace(SMP_TOFU_RE, "")
      .replace(INVIS_NICK_RE, "")
      .replace(/\uFFFD/g, "")
      .replace(/\s+/g, " ")
      .trim();
    const fb = String(fallbackUid || "İzleyici").replace(/^@+/, "").trim() || "İzleyici";
    const base = (stripped && VISIBLE_NICK_RE.test(stripped)) ? stripped : fb;
    return sliceCodePoints(base, 20);
  }

  function buildUser(u) {
    if (!u) return { id: "anon", unique_id: "izleyici", nickname: "İzleyici", avatar_url: null, avatar: { small: null }, flag: "", lang: "" };
    const uid = String(u.uid || u.unique_id || u.id || "izleyici");
    const prev = viewerProfiles.get(uid);
    const nick = cleanDisplayNick(u.nickname || prev?.nickname, uid);
    const rawAv = typeof u.avatar === "string" ? u.avatar : u.avatar?.small;
    const av = proxyAvatar(u.proxy_avatar || rawAv || u.avatar_url || null) || prev?.avatar_url || null;
    const lang = String(u.lang || prev?.lang || "");
    const flag = String(u.flag || prev?.flag || "");
    const city = String(u.city || prev?.city || "");
    const plate = String(u.plate || prev?.plate || "");
    const built = { id: uid, user_id: uid, secUid: uid, unique_id: uid, nickname: nick, avatar_url: av, avatar: { small: av, medium: av, large: av }, lang, flag, city, plate };
    if (uid && uid !== "izleyici" && uid !== "anon") {
      if (viewerProfiles.size > 900 && !prev) {
        let checked = 0;
        for (const k of viewerProfiles.keys()) {
          if (!joinedUsers.has(k)) {
            viewerProfiles.delete(k);
            break;
          }
          if (++checked >= 12) break;
        }
      }
      viewerProfiles.set(uid, built);
    }
    return built;
  }

  const G_IMG_BY_ID = {
    5655: G_IMG.gul,
    5487: G_IMG.pkalp,
    5658: G_IMG.parfum,
    5879: G_IMG.donat,
    5303: G_IMG.cay,
    11495: G_IMG.aile,
    9575: G_IMG.aile,
    6097: G_IMG.ktac,
    5924: G_IMG.ekalp,
    6968: G_IMG.ekalp,
    5660: G_IMG.ekalp,
    5502: G_IMG.tac
  };

  function resolveKnownGiftIcon(id, rawName) {
    if (G_IMG_BY_ID[id]) return G_IMG_BY_ID[id];
    const low = String(rawName || "").toLowerCase();
    if (low.includes("çay") || low.includes("tea") || low.includes("чай") || low.includes("thé")) return G_IMG.cay;
    if (low.includes("elle kalp") || low.includes("hand heart") || low.includes("handherz") || low.includes("händen") || low.includes("сердце руками") || low.includes("coeur avec")) return G_IMG.ekalp;
    if (low.includes("küçük taç") || low.includes("little crown") || low.includes("krönchen") || low.includes("маленькая корона") || low.includes("petite couronne")) return G_IMG.ktac;
    if (low.includes("taç") || low.includes("crown") || low.includes("корона") || low.includes("couronne")) return G_IMG.tac;
    if (low.includes("aile") || low.includes("family") || low.includes("familie") || low.includes("семья") || low.includes("famille")) return G_IMG.aile;
    if (low.includes("donat") || low.includes("donut") || low.includes("doughnut") || low.includes("пончик")) return G_IMG.donat;
    if (low.includes("parfüm") || low.includes("perfume") || low.includes("parfum") || low.includes("духи")) return G_IMG.parfum;
    if (low.includes("parmak kalp") || low.includes("finger") || low.includes("пальцы")) return G_IMG.pkalp;
    return G_IMG.gul;
  }

  async function ensureGiftCatalog() {
    if (giftCatalogCache) return giftCatalogCache;
    try {
      const r = await fetch("/assets/gifts.json", { cache: "no-cache" });
      const j = await r.json();
      const arr = Array.isArray(j) ? j : (Array.isArray(j.data) ? j.data : []);
      giftCatalogCache = j.data ? j : { success: true, count: arr.length, data: arr };
      for (const g of arr) {
        if (g && g.name) giftByName.set(String(g.name).toLowerCase(), g);
      }
      const aliases = {
        "gül": 5655, "rose": 5655, "роза": 5655,
        "parmak kalp": 5487, "finger heart": 5487, "fingerherz": 5487, "пальцы-сердце": 5487,
        "şimşek": 6652, "blitz": 6652,
        "tiktok": 5269,
        "parfüm": 5658, "perfume": 5658, "parfum": 5658, "духи": 5658,
        "donat": 5879, "doughnut": 5879, "donut": 5879, "пончик": 5879,
        "çay": 5303, "turkish tea": 5303, "турецкий чай": 5303, "чай": 5303, "thé": 5303,
        "aile": 11495, "family": 11495, "familie": 9575, "семья": 11495, "famille": 11495,
        "elle kalp": 5924, "hand heart": 6968, "handherz": 6968, "сердце руками": 6968, "coeur avec les mains": 6968,
        "küçük taç": 6097, "little crown": 6097, "krönchen": 6097, "маленькая корона": 6097, "petite couronne": 6097,
        "taç": 5502, "crown": 5502, "корона": 5502, "couronne": 5502
      };
      for (const [k, id] of Object.entries(aliases)) {
        const found = arr.find((x) => x.id === id);
        if (found) giftByName.set(k, found);
      }
      return giftCatalogCache;
    } catch (_) {
      return { success: true, count: 0, data: [] };
    }
  }

  function resolveGiftMeta(msg) {
    const rawName = String(msg.gift_name || "Gül").trim();
    const matched = giftByName.get(rawName.toLowerCase());
    const totalDiamonds = Math.max(1, Number(msg.diamonds || 1));
    const repeat = Math.max(1, Number(msg.repeat_count || 1));
    const unit = Number(msg.diamond_unit) || (matched ? matched.diamond_count : Math.max(1, Math.round(totalDiamonds / repeat)));
    const id = Number(msg.gift_id) || (matched ? matched.id : 5655);
    const rawImg = msg.gift_image || (matched && matched.image) || resolveKnownGiftIcon(id, rawName);
    return { id, name: rawName, image_url: rawImg, proxy_icon: proxyAvatar(rawImg), diamond_unit: unit, repeat, totalDiamonds };
  }

  function nextEventId(prefix) {
    return `${prefix}:${Date.now()}:${seqCounter++}`;
  }

  function isUserInHalay(uid) {
    if (!uid) return false;
    const inEngine = (
      Boolean(window.halay?.roles?._find?.(uid)) ||
      Boolean(window.halay?.roles?.charOf?.(uid)) ||
      Boolean(window.halay?.roles?.queue?.some?.((u) => u?.id === uid)) ||
      Boolean(window.halay?.line?.joiners?.some?.((j) => (j?.c || j)?.viewer?.id === uid)) ||
      Boolean(window.halay?.line?.walkers?.some?.((w) => (w?.c || w)?.viewer?.id === uid))
    );
    if (inEngine) return true;
    if (joinedUsers.has(uid)) {
      const lineReady = (window.halay?.line?.dancers?.length || 0) >= 20;
      const inSpawnBuf = pendingRoleSpawns.some((x) => x.user?.id === uid);
      if (lineReady && !inSpawnBuf) {
        joinedUsers.delete(uid);
        return false;
      }
      return true;
    }
    return false;
  }

  // --- Polyphony-Capped Zero-Dependency WebAudio Synth (TikOyun Alert Chimes) ---
  const AlertSfx = {
    ctx: null,
    master: null,
    noiseBuf: null,
    lastCueTs: 0,
    muted: localStorage.getItem("divalar:sfx_muted") === "1",
    isIOS: /iPhone|iPad|iPod/i.test(navigator.userAgent || ""),

    toggleMute() {
      this.muted = !this.muted;
      try { localStorage.setItem("divalar:sfx_muted", this.muted ? "1" : "0"); } catch (_) {}
      HalayJukeboxAudio.setMuted(this.muted);
      return this.muted;
    },

    _ensureGraph() {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      if (!this.ctx) {
        try { this.ctx = new AC(); } catch (_) { return null; }
      }
      if (!this.master) {
        const comp = this.ctx.createDynamicsCompressor();
        comp.threshold.value = -16;
        comp.ratio.value = 6;
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.20;
        this.master.connect(comp);
        comp.connect(this.ctx.destination);
        const len = Math.floor(this.ctx.sampleRate * 0.25);
        this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const ch = this.noiseBuf.getChannelData(0);
        for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1;
      }
      return this.ctx;
    },

    play(kind) {
      if (this.muted || this.isIOS || (IS_OBS && !IS_OBS_STUDIO)) return;
      const minGap = (kind === "vip" || kind === "wedding" || kind === "goal") ? 550 : 950;
      const now = performance.now();
      if (now - this.lastCueTs < minGap) return;
      const ctx = this._ensureGraph();
      if (!ctx) return;
      this.lastCueTs = now;
      const fire = () => {
        if (ctx.state !== "running") return;
        const t = ctx.currentTime;
        const tone = (freq, start, dur, type = "sine", peak = 0.55, endFreq = null) => {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.type = type;
          o.frequency.setValueAtTime(freq, start);
          if (endFreq) o.frequency.exponentialRampToValueAtTime(endFreq, start + dur * 0.85);
          g.gain.setValueAtTime(0.0001, start);
          g.gain.linearRampToValueAtTime(peak, start + 0.01);
          g.gain.exponentialRampToValueAtTime(0.0008, start + dur);
          o.connect(g);
          g.connect(this.master);
          o.start(start);
          o.stop(start + dur + 0.01);
        };
        if (kind === "join") {
          tone(420, t, 0.11, "sine", 0.5, 760);
        } else if (kind === "gift") {
          [880, 1108.7, 1318.5].forEach((f, i) => tone(f, t + i * 0.055, 0.22, "triangle", 0.48));
        } else if (kind === "davul") {
          tone(118, t, 0.28, "triangle", 0.85, 46);
        } else if (kind === "wedding") {
          [440, 466.16, 554.37, 659.25].forEach((f, i) => tone(f, t + i * 0.075, i === 3 ? 0.26 : 0.10, "triangle", 0.55));
        } else if (kind === "vip" || kind === "goal") {
          [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, t + i * 0.07, i === 3 ? 0.34 : 0.18, "triangle", 0.62));
        }
      };
      if (ctx.state === "suspended") {
        ctx.resume().then(fire).catch(() => {});
      } else {
        fire();
      }
    }
  };

  // --- Non-Looping Halay Jukebox Streamer (Streams /api/jukebox/stream/{id} with Anti-Fingerprint Pitch/Tempo Variance) ---
  const HalayJukeboxAudio = {
    el: null,
    currentId: "",
    currentUrl: "",
    currentTitle: "",
    currentRequestedBy: "",
    currentRequestedFlag: "",
    trackIdx: 0,
    lastAdvanceTs: 0,
    muted: (IS_OBS || IS_OBS_STUDIO)
      ? params.get("mute") === "1"
      : (localStorage.getItem("divalar:sfx_muted") === "1" || params.get("mute") === "1"),

    ensureEl() {
      if (this.el) return this.el;
      const a = document.createElement("audio");
      a.id = "halay-jukebox-audio";
      a.preload = "auto";
      a.autoplay = true;
      a.crossOrigin = "anonymous";
      a.volume = 0.42;
      a.muted = this.muted;
      a.style.display = "none";
      a.addEventListener("canplay", () => {
        if (!this.muted && a.paused && this.currentUrl) a.play().catch(() => {});
      });
      a.addEventListener("ended", () => this.requestNext());
      a.addEventListener("error", () => this.requestNext());
      (document.body || document.documentElement).appendChild(a);
      this.el = a;
      return a;
    },

    setMuted(flag) {
      this.muted = Boolean(flag);
      const a = this.ensureEl();
      a.muted = this.muted;
      if (!this.muted && a.paused && this.currentUrl) {
        a.play().catch(() => {});
      }
    },

    requestNext() {
      const now = Date.now();
      if (now - this.lastAdvanceTs < 2600) return;
      this.lastAdvanceTs = now;
      if (ws && ws.readyState === WebSocket.OPEN) {
        try { ws.send(JSON.stringify({ action: "jukebox_next" })); } catch (_) {}
      }
    },

    sync(payload) {
      if (!payload || typeof payload !== "object") return;
      const track = payload.current || payload.track || null;
      if (!track || !track.id) return;
      const a = this.ensureEl();
      const streamUrl = track.stream_url || `/api/jukebox/stream/${track.id}`;
      this.trackIdx = Number(payload.current_index ?? this.trackIdx) || 0;
      const rate = Number((0.984 + ((this.trackIdx % 9) * 0.004)).toFixed(3));
      const changed = this.currentId !== String(track.id);
      this.currentId = String(track.id);
      this.currentUrl = streamUrl;
      this.currentRequestedBy = String(payload.requested_by || track.requested_by || "").trim();
      this.currentRequestedFlag = String(payload.requested_flag || "").trim();
      const rawTitle = String(track.title || "").replace(/\[[^\]]*\]|\([^)]*\)/g, "").replace(/\s+/g, " ").trim();
      this.currentTitle = sliceCodePoints(rawTitle, 24);
      if (changed) {
        a.src = streamUrl;
        if (this.currentRequestedBy) {
          TopDock?.flashActionPill?.("dj", this.currentRequestedBy);
        }
      }
      try {
        if ("preservesPitch" in a) a.preservesPitch = false;
        if ("webkitPreservesPitch" in a) a.webkitPreservesPitch = false;
        a.playbackRate = rate;
      } catch (_) {}
      a.muted = this.muted;
      if (!this.muted && (changed || a.paused)) {
        a.play().catch(() => {});
      }
      TopDock?.updateAudioBadge?.();
    },

    tryUnlock() {
      if (AlertSfx.ctx && AlertSfx.ctx.state === "suspended") AlertSfx.ctx.resume().catch(() => {});
      if (this.el && !this.muted && this.el.paused && this.currentUrl) {
        this.el.play().catch(() => {});
      }
    }
  };
  window.__halayJukebox = HalayJukeboxAudio;

  const AiHostVoicePlayer = {
    el: null,
    _duckTimer: null,
    _queue: [],
    _playing: false,
    _activeLang: "",
    ensureEl() {
      if (this.el) return this.el;
      const a = document.createElement("audio");
      a.id = "halay-ai-tts-audio";
      a.preload = "auto";
      a.volume = 0.96;
      a.style.display = "none";
      const finish = () => {
        if (this._duckTimer) {
          clearTimeout(this._duckTimer);
          this._duckTimer = null;
        }
        this._playing = false;
        if (this._queue.length > 0) {
          const nextItem = this._queue.shift();
          this._playNow(nextItem.url, nextItem.lang);
        } else {
          this._activeLang = "";
          if (HalayJukeboxAudio.el && !HalayJukeboxAudio.muted) {
            HalayJukeboxAudio.el.volume = 0.42;
          }
          TopDock?.updateAudioBadge?.();
          DjSubtitleBar?.onVoiceStop?.();
        }
      };
      a.addEventListener("ended", finish);
      a.addEventListener("error", finish);
      (document.body || document.documentElement).appendChild(a);
      this.el = a;
      return a;
    },
    play(ttsUrl, lang = "") {
      if (!ttsUrl || AlertSfx.muted) return;
      if (this._playing) {
        if (this._queue.length < 4) this._queue.push({ url: ttsUrl, lang });
        return;
      }
      this._playNow(ttsUrl, lang);
    },
    _playNow(ttsUrl, lang = "") {
      const a = this.ensureEl();
      this._playing = true;
      this._activeLang = String(lang || "").toUpperCase();
      TopDock?.updateAudioBadge?.();
      if (this._duckTimer) {
        clearTimeout(this._duckTimer);
        this._duckTimer = null;
      }
      if (HalayJukeboxAudio.el && !HalayJukeboxAudio.muted) {
        HalayJukeboxAudio.el.volume = 0.14;
        this._duckTimer = setTimeout(() => {
          this._playing = false;
          if (this._queue.length > 0) {
            const nextItem = this._queue.shift();
            this._playNow(nextItem.url, nextItem.lang);
          } else {
            this._activeLang = "";
            if (HalayJukeboxAudio.el && !HalayJukeboxAudio.muted) {
              HalayJukeboxAudio.el.volume = 0.42;
            }
            TopDock?.updateAudioBadge?.();
            DjSubtitleBar?.onVoiceStop?.();
          }
          this._duckTimer = null;
        }, 10000);
      }
      a.src = ttsUrl;
      a.currentTime = 0;
      a.play().catch(() => {
        this._playing = false;
        this._activeLang = "";
        if (HalayJukeboxAudio.el && !HalayJukeboxAudio.muted) {
          HalayJukeboxAudio.el.volume = 0.42;
        }
        TopDock?.updateAudioBadge?.();
      });
    }
  };
  window.__halayAiVoice = AiHostVoicePlayer;

  const StageFxEngine = {
    _discoTimer: null,
    _discoInterval: null,
    _savedBg: null,
    _savedLights: [],
    _giantTimers: new Map(),

    initStrip() {
      document.getElementById("halay-fx-strip")?.remove();
    },

    _findDancerObj(uid) {
      const id = String(uid || "");
      const dancers = window.halay?.line?.dancers || [];
      let ch = dancers.find((d) => String(d?.viewer?.id || "") === id);
      if (!ch && id) {
        try { ch = window.halay?.roles?.charOf?.(id) || window.halay?.roles?._find?.(id); } catch (_) {}
      }
      if (!ch && dancers.length) ch = dancers[0];
      const root = ch?.group || ch?.root || ch?.mesh || ch || null;
      return root?.children?.[0] || root;
    },

    triggerGiant(uid, nickname, durationMs = 45000, lang = "") {
      const obj = this._findDancerObj(uid);
      if (obj && obj.scale?.setScalar) {
        obj.scale.setScalar(2.15);
        const key = String(uid || "top");
        if (this._giantTimers.has(key)) clearTimeout(this._giantTimers.get(key));
        this._giantTimers.set(key, setTimeout(() => {
          try { obj.scale.setScalar(1.0); } catch (_) {}
          this._giantTimers.delete(key);
        }, durationMs));
      }
      const p = HudLangEngine.pack(lang || HudLangEngine.getUserLang(uid));
      StageScheduler.enqueue({
        priority: 0, kind: "fx_giant", template: "rich", accent: "#22c55e",
        badge: p.fxGiantBadge, user: { id: uid || "fx", nickname: nickname || p.champFb },
        subText: p.fxGiantSub, sfx: "vip", ttl: 3600
      });
    },

    triggerShockwave(uid, nickname, lang = "") {
      const dancers = window.halay?.line?.dancers || [];
      let stepCount = 0;
      const iv = setInterval(() => {
        stepCount++;
        const lift = stepCount <= 3 ? 0.85 : 0;
        for (let i = 0; i < dancers.length; i++) {
          const obj = (dancers[i]?.group || dancers[i]?.root)?.children?.[0];
          if (obj?.position) obj.position.y = lift * (i % 2 === 0 ? 1 : 0.6);
        }
        if (stepCount >= 4) clearInterval(iv);
      }, 140);
      const p = HudLangEngine.pack(lang || HudLangEngine.getUserLang(uid));
      StageScheduler.enqueue({
        priority: 0, kind: "fx_shock", template: "rich", accent: "#38bdf8",
        badge: p.fxShockBadge, user: { id: uid || "fx", nickname: nickname || p.stageFb },
        subText: p.fxShockSub, sfx: "davul", ttl: 3400
      });
    },

    triggerDisco(uid, nickname, durationMs = 45000, lang = "") {
      const scene = window.halay?.engine?.scene;
      if (scene) {
        StageDirector.captureBaseline(scene);
        if (this._discoTimer) clearTimeout(this._discoTimer);
        if (this._discoInterval) clearInterval(this._discoInterval);
        const discoBg = scene.fog?.color?.clone?.();
        if (discoBg) { discoBg.setHex(0x160a38); scene.background = discoBg; }
        else if (scene.background?.setHex) scene.background.setHex(0x160a38);
        let tick = 0;
        const lights = StageDirector._baseLights || [];
        this._discoInterval = setInterval(() => {
          tick++;
          const hue = (tick * 0.14) % 1;
          for (let i = 0; i < lights.length; i++) {
            try { lights[i].light.color.setHSL((hue + i * 0.28) % 1, 0.88, 0.58); } catch (_) {}
          }
        }, 280);
        this._discoTimer = setTimeout(() => {
          if (this._discoInterval) clearInterval(this._discoInterval);
          this._discoInterval = null;
          this._discoTimer = null;
          StageDirector.applyAtmosphere();
        }, durationMs);
      }
      const p = HudLangEngine.pack(lang || HudLangEngine.getUserLang(uid));
      StageScheduler.enqueue({
        priority: 0, kind: "fx_disco", template: "rich", accent: "#e879f9",
        badge: p.fxDiscoBadge, user: { id: uid || "fx", nickname: nickname || p.stageFb },
        subText: p.fxDiscoSub, sfx: "wedding", ttl: 4200
      });
    },

    trigger(fx, uid, nickname, city, lang = "") {
      if (fx === "giant") this.triggerGiant(uid, nickname, 45000, lang);
      else if (fx === "shockwave") this.triggerShockwave(uid, nickname, lang);
      else if (fx === "disco") this.triggerDisco(uid, nickname, 45000, lang);
      else if (fx === "city_champion") {
        const p = HudLangEngine.pack(lang || HudLangEngine.current);
        StageScheduler.enqueue({
          priority: 0, kind: "city_champ", template: "rich", accent: "#fbbf24",
          badge: p.fxCityBadge, user: { id: "city", nickname: city || "Türkiye" },
          subText: p.fxCitySub, sfx: "vip", ttl: 4200
        });
      }
    }
  };
  window.__halayFx = StageFxEngine;
  if (document.body) StageFxEngine.initStrip();
  else window.addEventListener("DOMContentLoaded", () => StageFxEngine.initStrip(), { once: true });

  ["pointerdown", "keydown"].forEach((evName) => {
    window.addEventListener(evName, () => HalayJukeboxAudio.tryUnlock(), { passive: true });
  });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) HalayJukeboxAudio.tryUnlock();
  });

  // --- Minimal Modern Zero-Overlap Spatial Styles (Bands: 15.2-22.2vh Dock | 23.4-30.2vh Stage | 31-65vh Clear 3D Halay) ---
  function initMinimalStyles() {
    const old1 = document.getElementById("halay-toast-styles");
    if (old1) old1.remove();
    if (document.getElementById("halay-minimal-ui-styles")) return;

    const style = document.createElement("style");
    style.id = "halay-minimal-ui-styles";
    style.textContent = `
      :root {
        --stream-w: min(100vw, 56.25vh);
        --u: calc(var(--stream-w) * 0.01);
        --safe-w: calc(var(--u) * 74);
        --du: calc(var(--safe-w) / 81);
        --font-ui: 'Segoe UI', 'Inter', system-ui, -apple-system, 'Segoe UI Emoji', 'Apple Color Emoji', 'Noto Color Emoji', sans-serif;
        --glass-bg: rgba(7, 10, 19, 0.92);
        --glass-hi: rgba(10, 14, 26, 0.96);
        --glass-line: rgba(255, 255, 255, 0.22);
      }

      /* Hide legacy stacking feed so zero elements ever climb over dancers */
      .feed { display: none !important; }
      #halay-cinema-hud, #halay-stage, #halay-dj-subtitle {
        text-shadow: 0 1.5px 3px rgba(0, 0, 0, 0.96);
        text-rendering: optimizeLegibility;
      }
      #halay-cinema-hud, #halay-cinema-hud *, #halay-stage, #halay-stage *, #halay-dj-subtitle, #halay-dj-subtitle *, .ay-gear { box-sizing: border-box !important; }

      /* Band 2A: Unified Cinematic Multilingual Interactive HUD (Compact Top Safe-Zone) */
      #halay-cinema-hud {
        position: fixed;
        top: 10.6vh;
        left: 50%;
        transform: translateX(-50%);
        width: min(94vw, calc(var(--safe-w) * 1.12));
        z-index: 9982;
        display: flex;
        flex-direction: column;
        gap: 0.16vh;
        padding: 0.22vh calc(var(--du) * 0.95) 0.22vh;
        border-radius: calc(var(--du) * 1.6);
        background: linear-gradient(180deg, rgba(11, 15, 28, 0.94) 0%, rgba(6, 8, 16, 0.95) 100%);
        border: 1.4px solid rgba(253, 224, 71, 0.38);
        box-shadow: 0 4px 14px rgba(0, 0, 0, 0.65), inset 0 1px 0 rgba(255, 255, 255, 0.12);
        color: #ffffff;
        font-family: var(--font-ui);
        -webkit-font-smoothing: antialiased;
        text-rendering: geometricPrecision;
        user-select: none;
        overflow: hidden;
        contain: layout paint;
      }
      html.obs-clean:not(.obs-true-center) #halay-cinema-hud,
      html.obs-clean:not(.obs-true-center) #halay-stage,
      html.obs-clean:not(.obs-true-center) #halay-dj-subtitle {
        left: 50%;
      }
      html.obs-true-center .ay-gear:not(:hover) { opacity: 0 !important; }
      body.ay-open #halay-cinema-hud,
      body.ay-open #halay-stage,
      body.ay-open #halay-dj-subtitle { opacity: 0 !important; pointer-events: none !important; }
      #halay-cinema-hud.is-collapsed .ch-podium,
      #halay-cinema-hud.is-collapsed .ch-guide,
      #halay-cinema-hud.is-collapsed .ch-vs,
      #halay-cinema-hud.is-collapsed .ch-party-bar,
      #halay-cinema-hud.is-collapsed #halay-gift-ladder { display: none; }
      html.obs-clean .htd-ibtn, html.dikey-916-crop .htd-ibtn { display: none !important; }

      .ch-top {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: calc(var(--du) * 0.55);
        height: 2.05vh;
        min-width: 0;
      }
      .ch-title-wrap {
        display: inline-flex;
        align-items: center;
        gap: calc(var(--du) * 0.7);
        min-width: 0;
        flex: 1;
      }
      .ch-title-wrap.is-morph { animation: ch-morph-in 0.24s ease-out; }
      @keyframes ch-morph-in {
        0% { opacity: 0.35; transform: translateY(-2px); }
        100% { opacity: 1; transform: translateY(0); }
      }
      .htd-dot {
        width: calc(var(--du) * 1.45);
        height: calc(var(--du) * 1.45);
        border-radius: 50%;
        background: #34d399;
        box-shadow: 0 0 8px #34d399;
        flex: none;
      }
      .ch-lang-pill {
        display: inline-flex;
        align-items: center;
        gap: calc(var(--du) * 0.38);
        padding: 0.10vh calc(var(--du) * 0.85);
        border-radius: 999px;
        background: rgba(56, 189, 248, 0.22);
        border: 1px solid rgba(56, 189, 248, 0.48);
        color: #e0f2fe;
        font-size: calc(var(--du) * 1.72);
        font-weight: 850;
        flex: none;
      }
      .ch-flag-svg {
        width: calc(var(--du) * 2.15);
        height: calc(var(--du) * 2.15);
        border-radius: 50%;
        overflow: hidden;
        display: inline-block;
        vertical-align: -2px;
        flex: none;
        box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.45);
      }
      .ch-title {
        font-size: calc(var(--du) * 2.15);
        font-weight: 900;
        letter-spacing: 0.03em;
        color: #fef08a;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .htd-right {
        display: inline-flex;
        align-items: center;
        gap: calc(var(--du) * 0.55);
        flex: none;
      }
      .ch-audio-pill {
        display: inline-flex;
        align-items: center;
        gap: calc(var(--du) * 0.52);
        max-width: calc(var(--du) * 23);
        padding: 0.14vh calc(var(--du) * 0.95);
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(255, 255, 255, 0.20);
        color: #e2e8f0;
        font-size: calc(var(--du) * 1.66);
        font-weight: 800;
        white-space: nowrap;
        overflow: hidden;
      }
      .ch-audio-pill.is-dj {
        background: rgba(168, 85, 247, 0.28);
        border-color: rgba(192, 132, 252, 0.68);
        color: #f3e8ff;
      }
      .ch-eq {
        display: inline-flex;
        align-items: flex-end;
        gap: 2px;
        height: calc(var(--du) * 1.85);
        flex: none;
      }
      .ch-eq i {
        display: block;
        width: 2.5px;
        height: 100%;
        border-radius: 2px;
        background: #fde047;
        transform-origin: bottom;
        animation: ch-eq-dance 0.72s ease-in-out infinite alternate;
      }
      .ch-audio-pill.is-dj .ch-eq i { background: #38bdf8; animation-duration: 0.36s; }
      .ch-eq i:nth-child(2) { animation-delay: 0.14s; }
      .ch-eq i:nth-child(3) { animation-delay: 0.30s; }
      .ch-eq i:nth-child(4) { animation-delay: 0.44s; }
      @keyframes ch-eq-dance {
        0% { transform: scaleY(0.28); }
        100% { transform: scaleY(1.0); }
      }
      #ch-audio-txt { overflow: hidden; text-overflow: ellipsis; }
      .htd-goal-pill {
        display: inline-flex;
        align-items: center;
        gap: calc(var(--du) * 0.4);
        padding: 0.14vh calc(var(--du) * 1.05);
        border-radius: 999px;
        background: rgba(16, 185, 129, 0.26);
        border: 1px solid rgba(52, 211, 153, 0.56);
        color: #ecfdf5;
        font-size: calc(var(--du) * 1.85);
        font-weight: 850;
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
      }
      .htd-ibtn {
        pointer-events: auto;
        display: inline-grid;
        place-items: center;
        width: calc(var(--du) * 3.0);
        height: calc(var(--du) * 3.0);
        padding: 0;
        border-radius: 999px;
        border: 1px solid rgba(255, 255, 255, 0.22);
        background: rgba(255, 255, 255, 0.10);
        color: #f8fafc;
        font-size: calc(var(--du) * 1.55);
        line-height: 1;
        cursor: pointer;
      }
      .htd-ibtn:hover { background: rgba(255, 255, 255, 0.22); }

      /* Band 2B: Interactive Royal Podium (Compact 4 Horizontal Broadcast Cards) */
      .ch-podium {
        display: grid;
        grid-template-columns: 0.96fr 1.24fr 0.96fr 0.92fr;
        gap: calc(var(--du) * 0.42);
        align-items: stretch;
        min-width: 0;
      }
      .ch-pod-card {
        position: relative;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 0.05vh;
        padding: 0.16vh calc(var(--du) * 0.34);
        border-radius: calc(var(--du) * 1.1);
        background: rgba(255, 255, 255, 0.06);
        border: 1.2px solid rgba(255, 255, 255, 0.16);
        min-width: 0;
        overflow: hidden;
        transition: transform 0.24s ease;
      }
      .ch-pod-card.is-throne {
        background: linear-gradient(180deg, rgba(250, 204, 21, 0.24) 0%, rgba(234, 179, 8, 0.08) 100%);
        border: 1.5px solid rgba(253, 224, 71, 0.72);
      }
      .ch-pod-card.is-throne.is-empty-seat {
        border-color: rgba(253, 224, 71, 0.92);
      }
      @keyframes ch-throne-pulse {
        0%, 100% { box-shadow: 0 0 10px rgba(250, 204, 21, 0.18); }
        50% { box-shadow: 0 0 20px rgba(250, 204, 21, 0.45); }
      }
      .ch-pod-card.is-empty-seat .ch-pod-nick {
        color: #fde68a;
        letter-spacing: 0.02em;
      }
      .ch-pod-card.is-bride {
        background: linear-gradient(180deg, rgba(244, 114, 182, 0.18) 0%, rgba(15, 23, 42, 0.35) 100%);
        border-color: rgba(251, 113, 133, 0.48);
      }
      .ch-pod-card.is-groom {
        background: linear-gradient(180deg, rgba(96, 165, 250, 0.18) 0%, rgba(15, 23, 42, 0.35) 100%);
        border-color: rgba(96, 165, 250, 0.48);
      }
      .ch-pod-card.is-star {
        background: linear-gradient(180deg, rgba(56, 189, 248, 0.16) 0%, rgba(15, 23, 42, 0.35) 100%);
        border-color: rgba(56, 189, 248, 0.42);
      }
      .ch-pod-card.is-flash { animation: ch-card-pop 0.42s ease-out; }
      @keyframes ch-card-pop {
        0% { transform: scale(1); }
        45% { transform: scale(1.06); }
        100% { transform: scale(1); }
      }
      .ch-pod-top {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: calc(var(--du) * 0.4);
        font-size: max(8.5px, calc(var(--du) * 1.40));
        font-weight: 850;
        letter-spacing: 0.03em;
        color: #cbd5e1;
        white-space: nowrap;
        max-width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .ch-pod-card.is-throne .ch-pod-top { color: #fde047; font-size: max(9px, calc(var(--du) * 1.54)); }
      .ch-pod-card.is-bride .ch-pod-top { color: #fda4af; }
      .ch-pod-card.is-groom .ch-pod-top { color: #93c5fd; }
      .ch-pod-card.is-star .ch-pod-top { color: #7dd3fc; }
      .ch-av-wrap {
        position: relative;
        width: calc(var(--du) * 2.95);
        height: calc(var(--du) * 2.95);
        flex: none;
      }
      .ch-pod-card.is-throne .ch-av-wrap {
        width: calc(var(--du) * 3.45);
        height: calc(var(--du) * 3.45);
      }
      .ch-av {
        width: 100%;
        height: 100%;
        border-radius: 50%;
        display: block;
        box-shadow: 0 0 0 1.4px rgba(255, 255, 255, 0.45);
      }
      .ch-pod-card.is-throne .ch-av {
        box-shadow: 0 0 0 1.8px #fde047;
      }
      .ch-av-flag {
        position: absolute;
        right: -2px;
        bottom: -2px;
        display: inline-flex;
        line-height: 1;
        filter: drop-shadow(0 1px 2px rgba(0,0,0,0.95));
      }
      .ch-av-flag .ch-flag-svg {
        width: calc(var(--du) * 1.75);
        height: calc(var(--du) * 1.75);
      }
      .ch-pod-nick {
        width: 100%;
        text-align: center;
        font-size: max(8.5px, calc(var(--du) * 1.46));
        font-weight: 850;
        color: #ffffff;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .ch-pod-card.is-throne .ch-pod-nick { font-size: max(9.5px, calc(var(--du) * 1.65)); color: #fef9c3; }
      .ch-pod-val {
        font-size: max(8.5px, calc(var(--du) * 1.44));
        font-weight: 850;
        font-variant-numeric: tabular-nums;
        color: #fde047;
        white-space: nowrap;
        max-width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .ch-pod-card.is-bride .ch-pod-val { color: #fecdd3; }
      .ch-pod-card.is-groom .ch-pod-val { color: #bfdbfe; }
      .ch-pod-card.is-star .ch-pod-val { color: #7dd3fc; }

      /* Band 2C: Free Chat Gameplay Strip (Single Compact Row — Zero Wrapping/Stacking) */
      .ch-guide {
        display: grid;
        grid-template-columns: repeat(5, minmax(0, 1fr));
        gap: calc(var(--du) * 0.30);
      }
      .ch-pill {
        display: flex;
        align-items: center;
        justify-content: center;
        min-width: 0;
        gap: calc(var(--du) * 0.18);
        height: 2.05vh;
        padding: 0 calc(var(--du) * 0.22);
        border-radius: calc(var(--du) * 0.85);
        background: rgba(16, 185, 129, 0.22);
        border: 1px solid rgba(52, 211, 153, 0.55);
        font-size: max(8px, calc(var(--du) * 1.28));
        font-weight: 900;
        color: #ffffff;
        white-space: nowrap;
        overflow: hidden;
        transition: transform 0.2s ease, border-color 0.2s ease, background 0.2s ease;
      }
      .ch-pill.is-hit {
        transform: scale(1.06);
        background: rgba(52, 211, 153, 0.42);
        border-color: #fde047;
        color: #ffffff;
      }
      .ch-pill-key {
        color: #fde047;
        font-weight: 900;
        flex: none;
      }
      .ch-pill-lbl {
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .ch-showcase {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: calc(var(--du) * 0.44);
      }
      .ch-sc-card {
        display: flex;
        align-items: center;
        gap: calc(var(--du) * 0.46);
        min-width: 0;
        padding: 0.20vh calc(var(--du) * 0.52);
        border-radius: calc(var(--du) * 1.05);
        background: rgba(255, 255, 255, 0.06);
        border: 1px solid rgba(255, 255, 255, 0.15);
        overflow: hidden;
      }
      .ch-sc-card.is-hidden-slot {
        display: none;
      }
      .ch-sc-card.is-gold {
        background: linear-gradient(90deg, rgba(250, 204, 21, 0.24) 0%, rgba(234, 179, 8, 0.10) 100%);
        border-color: rgba(253, 224, 71, 0.72);
      }
      .ch-sc-card.is-vip {
        background: linear-gradient(90deg, rgba(168, 85, 247, 0.20) 0%, rgba(56, 189, 248, 0.10) 100%);
        border-color: rgba(192, 132, 252, 0.48);
      }
      .ch-sc-ico {
        font-size: calc(var(--du) * 2.15);
        line-height: 1;
        flex: none;
      }
      .ch-sc-txt {
        display: flex;
        flex-direction: column;
        min-width: 0;
        line-height: 1.12;
      }
      .ch-sc-item {
        font-size: max(8.5px, calc(var(--du) * 1.40));
        font-weight: 900;
        color: #fef08a;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .ch-sc-role {
        font-size: max(8px, calc(var(--du) * 1.32));
        font-weight: 800;
        color: #f8fafc;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .ch-round-pill {
        display: inline-flex;
        align-items: center;
        gap: calc(var(--du) * 0.28);
        padding: 0.08vh calc(var(--du) * 0.72);
        border-radius: 999px;
        background: rgba(250, 204, 21, 0.18);
        border: 1px solid rgba(253, 224, 71, 0.48);
        color: #fef08a;
        font-size: max(8.5px, calc(var(--du) * 1.48));
        font-weight: 900;
        font-variant-numeric: tabular-nums;
        flex: none;
      }
      .ch-round-pill.is-2x {
        background: rgba(244, 63, 94, 0.34);
        border-color: #fb7185;
        color: #fff1f2;
      }
      .ch-party-bar {
        position: relative;
        height: max(11px, calc(var(--du) * 2.6));
        margin-top: 1px;
        border-radius: 999px;
        background: rgba(15, 23, 42, 0.56);
        border: 1px solid rgba(251, 191, 36, 0.36);
        overflow: hidden;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .ch-party-fill {
        position: absolute;
        left: 0;
        top: 0;
        bottom: 0;
        width: 0%;
        background: linear-gradient(90deg, #f59e0b 0%, #ec4899 55%, #8b5cf6 100%);
        transition: width 0.35s ease;
      }
      .ch-party-txt {
        position: relative;
        z-index: 1;
        font-size: max(8px, calc(var(--du) * 1.24));
        font-weight: 850;
        color: #fef3c7;
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.9);
        white-space: nowrap;
        letter-spacing: 0.02em;
      }

      /* Band 2D: Live Country / City / Wedding Team VS Tug-of-War Bar */
      .ch-vs {
        display: flex;
        flex-direction: column;
        gap: 0.12vh;
        padding-top: 0.04vh;
      }
      .ch-vs-labels {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: calc(var(--du) * 0.5);
        font-size: max(8.5px, calc(var(--du) * 1.48));
        font-weight: 850;
        font-variant-numeric: tabular-nums;
      }
      .ch-vs-side { display: inline-flex; align-items: center; gap: calc(var(--du) * 0.30); color: #e2e8f0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 44%; }
      .ch-vs-mid { color: #fde047; font-size: max(8px, calc(var(--du) * 1.32)); letter-spacing: 0.04em; flex: none; }
      .ch-vs-track {
        position: relative;
        width: 100%;
        height: 0.44vh;
        border-radius: 999px;
        background: linear-gradient(90deg, #e11d48 0%, #38bdf8 100%);
        overflow: hidden;
      }
      .ch-vs-fill {
        height: 100%;
        width: 50%;
        background: linear-gradient(90deg, #fb7185, #fde047);
        border-right: 2px solid #ffffff;
        transition: width 0.45s cubic-bezier(0.22, 1, 0.36, 1);
      }

      /* Non-Competing Gear Button */
      .ay-gear {
        position: fixed !important;
        top: 9.2vh !important;
        right: calc(50vw - var(--u) * 35.5) !important;
        width: calc(var(--u) * 4.4) !important;
        height: calc(var(--u) * 4.4) !important;
        padding: calc(var(--u) * 0.9) !important;
        border-radius: 50% !important;
        background: var(--glass-bg) !important;
        border: 1px solid var(--glass-line) !important;
        box-shadow: 0 3px 10px rgba(0, 0, 0, 0.32) !important;
        z-index: 9981 !important;
        opacity: 0.72 !important;
      }
      .ay-gear:hover { opacity: 1 !important; background: rgba(255, 255, 255, 0.14) !important; }
      .ay-gear img { filter: grayscale(1) brightness(1.6) !important; opacity: 0.9; }
      html.obs-clean .ay-gear, html.dikey-916-crop .ay-gear { opacity: 0.03 !important; }
      html.obs-clean .ay-gear:hover, html.dikey-916-crop .ay-gear:hover { opacity: 0.95 !important; }

      /* Band 2E: Single-Slot Priority Mutex Alert Stage (Cleanly Below HUD) */
      #halay-stage {
        position: fixed;
        top: 42.4vh;
        left: 50%;
        transform: translateX(-50%);
        width: var(--safe-w);
        height: auto;
        min-height: 0;
        max-height: 5.2vh;
        z-index: 9985;
        display: flex;
        align-items: center;
        justify-content: center;
        pointer-events: none;
        overflow: hidden;
        font-family: var(--font-ui);
        contain: layout paint;
      }
      .sc-card {
        max-width: 100%;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.68);
        animation: sc-in 0.18s cubic-bezier(0.16, 1, 0.3, 1) both;
        color: #ffffff;
        will-change: transform, opacity;
      }
      .sc-card.is-out { animation: sc-out 0.13s ease-in forwards; }
      @keyframes sc-in { from { opacity: 0; transform: translateY(5px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
      @keyframes sc-out { to { opacity: 0; transform: translateY(-4px) scale(0.98); } }
      @keyframes sc-pop { 0% { transform: scale(1); } 45% { transform: scale(1.20); } 100% { transform: scale(1); } }

      .sc-rich {
        display: flex;
        align-items: center;
        gap: calc(var(--du) * 1.15);
        width: 100%;
        height: 4.45vh;
        padding: 0.14vh calc(var(--du) * 1.55);
        border-radius: calc(var(--du) * 2.1);
        background: var(--glass-hi);
        border: 1.5px solid var(--sc-accent, rgba(253, 224, 71, 0.58));
      }
      .sc-av {
        width: calc(var(--du) * 4.5);
        height: calc(var(--du) * 4.5);
        border-radius: 50%;
        flex: none;
        box-shadow: 0 0 0 1.8px var(--sc-accent, #fde047);
      }
      .sc-mid { flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: center; gap: 0.10vh; }
      .sc-t1 {
        display: flex; align-items: center; gap: calc(var(--du) * 0.7);
        font-size: calc(var(--du) * 2.34); font-weight: 800; line-height: 1.24;
        color: #ffffff;
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      }
      .sc-badge {
        padding: 0.10vh calc(var(--du) * 0.95);
        border-radius: calc(var(--du) * 0.95);
        background: rgba(255, 255, 255, 0.18);
        color: var(--sc-accent, #fde047);
        font-size: calc(var(--du) * 1.78);
        font-weight: 800;
        letter-spacing: 0.02em;
        flex: none;
      }
      .sc-t2 {
        font-size: calc(var(--du) * 2.02); color: #ffffff; font-weight: 750; line-height: 1.24;
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      }
      .sc-end { display: inline-flex; align-items: center; gap: calc(var(--du) * 0.55); flex: none; max-width: 28%; overflow: hidden; }
      .sc-emblem { font-size: calc(var(--du) * 3.2); line-height: 1; flex: none; }
      .sc-gift-img { width: calc(var(--du) * 3.6); height: calc(var(--du) * 3.6); object-fit: contain; flex: none; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.65)); }
      .sc-combo {
        padding: 0.12vh calc(var(--du) * 1.0);
        border-radius: 999px;
        background: rgba(253, 224, 71, 0.24);
        border: 1px solid rgba(253, 224, 71, 0.55);
        color: #fde047;
        font-size: calc(var(--du) * 1.92);
        font-weight: 800;
        font-variant-numeric: tabular-nums;
      }
      .sc-combo.is-pop { animation: sc-pop 0.22s ease-out; }

      .sc-micro {
        display: inline-flex;
        align-items: center;
        gap: calc(var(--du) * 1.0);
        max-width: 100%;
        height: 3.45vh;
        padding: 0 calc(var(--du) * 1.9);
        border-radius: 999px;
        background: var(--glass-bg);
        border: 1.5px solid var(--sc-accent, rgba(255, 255, 255, 0.28));
        font-size: calc(var(--du) * 2.06);
        font-weight: 750;
        color: #ffffff;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .sc-micro .sc-av { width: calc(var(--du) * 3.7); height: calc(var(--du) * 3.7); }
      .sc-micro-txt { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .sc-micro-txt b { color: var(--sc-accent, #f8fafc); font-weight: 700; }
      .sc-dot { width: calc(var(--du) * 1.2); height: calc(var(--du) * 1.2); border-radius: 50%; background: var(--sc-accent, #38bdf8); flex: none; }

      /* Cinematic Multilingual DJ Film Subtitle Bar (36.0vh — Ordered Above Dancers, Zero Overlap) */
      #halay-dj-subtitle {
        position: fixed;
        top: 36.0vh;
        bottom: auto;
        left: 50%;
        transform: translateX(-50%) translateY(-4px);
        width: var(--safe-w);
        z-index: 9986;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.18vh;
        padding: 0.38vh calc(var(--du) * 1.4);
        border-radius: calc(var(--du) * 2.0);
        background: rgba(6, 9, 18, 0.91);
        border: 1.4px solid rgba(56, 189, 248, 0.52);
        box-shadow: 0 6px 20px rgba(0, 0, 0, 0.78);
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.22s ease, transform 0.22s ease;
        font-family: var(--font-ui);
        contain: layout paint;
      }
      #halay-dj-subtitle.is-open {
        opacity: 1;
        transform: translateX(-50%) translateY(0);
      }
      .djs-meta {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: calc(var(--du) * 0.42);
        font-size: calc(var(--du) * 1.65);
        font-weight: 850;
        color: #7dd3fc;
        letter-spacing: 0.03em;
      }
      .djs-line {
        font-size: calc(var(--du) * 2.28);
        font-weight: 850;
        line-height: 1.26;
        color: #ffffff;
        text-align: center;
        text-shadow: 0 2px 6px rgba(0, 0, 0, 0.98);
      }

      /* TikOyun Exact 8-Gift Visual Strip (Docked INSIDE #halay-cinema-hud — Zero Overlap on Any Resolution) */
      #halay-gift-ladder {
        width: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 1px 2px 2px;
        margin-top: 1px;
        border-radius: calc(var(--du) * 0.9);
        background: rgba(6, 9, 18, 0.56);
        border: 1px solid rgba(255, 255, 255, 0.08);
        pointer-events: none;
        overflow: hidden;
        font-family: var(--font-ui);
      }
      .gl-strip-img, .gl-icons-img {
        width: 100%;
        height: max(22px, calc(var(--du) * 5.2));
        display: block;
        object-fit: contain;
        filter: drop-shadow(0 1px 4px rgba(0, 0, 0, 0.75));
      }
      .gl-tr-labels {
        width: 100%;
        display: grid;
        grid-template-columns: repeat(8, minmax(0, 1fr));
        gap: 1px;
        margin-top: 2px;
        text-align: center;
      }
      .gl-tr-lbl {
        font-size: clamp(7px, calc(var(--du) * 1.32), 13.5px);
        font-weight: 900;
        line-height: 1.22;
        color: #ffffff;
        text-transform: uppercase;
        letter-spacing: 0em;
        -webkit-text-stroke: 1px #000000;
        paint-order: stroke fill;
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.95);
        white-space: nowrap;
        max-width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
        word-break: normal;
      }
      .gl-costs {
        width: 100%;
        display: grid;
        grid-template-columns: repeat(8, minmax(0, 1fr));
        gap: 1px;
        margin-top: 2px;
        text-align: center;
      }
      .gl-cost {
        font-size: clamp(7.5px, calc(var(--du) * 1.36), 14px);
        font-weight: 900;
        line-height: 1.24;
        color: #fde047;
        -webkit-text-stroke: 1.2px #000000;
        paint-order: stroke fill;
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.95);
        white-space: nowrap;
      }

      /* Minimal Modern Linear/shadcn Settings Modal Overrides (9:16 Safe on 1920x1080 & Mobile) */
      .ay {
        --bg: #0b0b0f !important; --surface: #14141b !important; --surface-2: #1d1d27 !important;
        --hover: #272734 !important; --line: rgba(255,255,255,0.09) !important;
        --ink: #f8fafc !important; --muted: #94a3b8 !important;
        --kina: #e11d48 !important; --kina-hi: #f43f5e !important; --kina-text: #fda4af !important;
        font: 500 clamp(10.5px, calc(var(--u) * 2.4), 12.5px)/1.4 var(--font-ui) !important;
        padding: 8px !important; z-index: 10020 !important;
      }
      .ay-panel {
        width: min(460px, calc(var(--u) * 92)) !important;
        max-height: min(620px, 76vh) !important;
        grid-template-columns: 1fr !important;
        grid-template-rows: auto auto 1fr !important;
        border-radius: 14px !important;
        background: rgba(11, 11, 15, 0.94) !important;
        border: 1px solid rgba(255,255,255,0.11) !important;
      }
      .ay-head { padding: 9px 12px !important; gap: 8px !important; }
      .ay-title { font: 700 clamp(13px, calc(var(--u) * 3.1), 15.5px)/1.2 var(--font-ui) !important; letter-spacing: -0.02em !important; }
      .ay-hint { display: none !important; }
      .ay-tabs {
        display: grid !important; grid-template-columns: repeat(3, 1fr) !important;
        gap: 4px !important; margin: 6px 10px 0 !important; padding: 3px !important;
        border: 1px solid rgba(255,255,255,0.07) !important; border-radius: 9px !important;
        background: rgba(255,255,255,0.035) !important;
      }
      .ay-tab {
        padding: 5px 6px !important; border-radius: 6px !important; text-align: center !important;
        text-decoration: none !important; font-size: clamp(10px, calc(var(--u) * 2.3), 12px) !important;
      }
      .ay-tab[aria-selected=true] { background: rgba(255,255,255,0.11) !important; color: #fff !important; font-weight: 650 !important; }
      .ay-body { padding: 10px 12px 12px !important; }
      .ay-body h3 { font-size: clamp(11.5px, calc(var(--u) * 2.6), 13px) !important; margin: 0 0 3px !important; }
      .ay-body h3.ay-gap { margin-top: 12px !important; }
      .ay-body p.ay-sub { font-size: clamp(10px, calc(var(--u) * 2.2), 11.5px) !important; margin: 0 0 8px !important; }
      .ay-choices { grid-template-columns: 1fr 1fr !important; gap: 6px !important; }
      .ay-choice { padding: 7px 9px !important; border-radius: 8px !important; gap: 2px !important; }
      .ay-choice strong { font-size: clamp(10.5px, calc(var(--u) * 2.4), 12px) !important; }
      .ay-choice span { font-size: clamp(9.5px, calc(var(--u) * 2.0), 10.5px) !important; }
      .ay-rule { grid-template-columns: minmax(0, 1fr) 118px auto auto !important; gap: 5px !important; padding: 4px 6px !important; border-radius: 8px !important; }
      .ay-trig img, .ay-trig .ay-ico { width: 22px !important; height: 22px !important; font-size: 12px !important; border-radius: 6px !important; }
      .ay-trig .ay-tmeta { font-size: 10px !important; }
      .ay-btn { min-height: 26px !important; padding: 3px 9px !important; border-radius: 7px !important; font-size: clamp(10px, calc(var(--u) * 2.25), 11.5px) !important; }
      .ay-btn.icon { width: 24px !important; min-width: 24px !important; min-height: 24px !important; }
      .ay-select, .ay-search { min-height: 26px !important; padding: 3px 22px 3px 8px !important; border-radius: 7px !important; font-size: clamp(10px, calc(var(--u) * 2.25), 11.5px) !important; }
      .ay-srow { padding: 7px 10px !important; border-radius: 8px !important; }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  const _FLAG_EMOJI_TO_CODE = {
    "🇹🇷": "tr", "🇬🇧": "en", "🇺🇸": "en", "🇷🇺": "ru",
    "🇸🇦": "ar", "🇪🇸": "es", "🇩🇪": "de", "🇫🇷": "fr", "🇦🇿": "az"
  };

  function flagSvg(codeOrFlag) {
    const raw = String(codeOrFlag || "").trim();
    const k = _FLAG_EMOJI_TO_CODE[raw] || raw.toLowerCase();
    let inner = '<rect width="24" height="24" fill="#0284c7"/><circle cx="12" cy="12" r="6" fill="none" stroke="#e0f2fe" stroke-width="1.6"/><path d="M6 12h12M12 6v12" stroke="#e0f2fe" stroke-width="1.3"/>';
    if (k === "tr") {
      inner = '<rect width="24" height="24" fill="#e11d48"/><circle cx="10.2" cy="12" r="5.1" fill="#ffffff"/><circle cx="11.6" cy="12" r="4.0" fill="#e11d48"/><polygon points="15.8,9.8 16.4,11.4 18.1,11.4 16.7,12.4 17.2,14.0 15.8,13.0 14.4,14.0 14.9,12.4 13.5,11.4 15.2,11.4" fill="#ffffff"/>';
    } else if (k === "ru") {
      inner = '<rect width="24" height="8" y="0" fill="#ffffff"/><rect width="24" height="8" y="8" fill="#1d4ed8"/><rect width="24" height="8" y="16" fill="#dc2626"/>';
    } else if (k === "en" || k === "gb") {
      inner = '<rect width="24" height="24" fill="#1e3a8a"/><path d="M0 0L24 24M24 0L0 24" stroke="#ffffff" stroke-width="3.6"/><path d="M0 0L24 24M24 0L0 24" stroke="#dc2626" stroke-width="1.6"/><path d="M12 0V24M0 12H24" stroke="#ffffff" stroke-width="6"/><path d="M12 0V24M0 12H24" stroke="#dc2626" stroke-width="3.2"/>';
    } else if (k === "ar" || k === "sa") {
      inner = '<rect width="24" height="24" fill="#059669"/><rect x="5" y="9" width="14" height="2.4" rx="1.2" fill="#ffffff"/><rect x="6" y="14" width="12" height="1.8" rx="0.9" fill="#ffffff"/>';
    } else if (k === "es") {
      inner = '<rect width="24" height="6" y="0" fill="#dc2626"/><rect width="24" height="12" y="6" fill="#facc15"/><rect width="24" height="6" y="18" fill="#dc2626"/>';
    } else if (k === "de") {
      inner = '<rect width="24" height="8" y="0" fill="#111827"/><rect width="24" height="8" y="8" fill="#dc2626"/><rect width="24" height="8" y="16" fill="#facc15"/>';
    } else if (k === "fr") {
      inner = '<rect width="8" height="24" x="0" fill="#1d4ed8"/><rect width="8" height="24" x="8" fill="#ffffff"/><rect width="8" height="24" x="16" fill="#dc2626"/>';
    } else if (k === "az") {
      inner = '<rect width="24" height="8" y="0" fill="#0284c7"/><rect width="24" height="8" y="8" fill="#dc2626"/><rect width="24" height="8" y="16" fill="#16a34a"/><circle cx="11.2" cy="12" r="2.8" fill="#ffffff"/><circle cx="12.1" cy="12" r="2.2" fill="#dc2626"/><circle cx="14.2" cy="12" r="1.0" fill="#ffffff"/>';
    }
    return `<svg class="ch-flag-svg" viewBox="0 0 24 24" aria-hidden="true">${inner}</svg>`;
  }

  // --- 8-Language Chameleon Dictionary, Interactive HUD & Royal Broadcast Controller ---
  const HUD_I18N = {
    tr: {
      flag: "🇹🇷", code: "TR", stageTitle: "KIR DÜĞÜNÜ MEYDANI", dancerUnit: "Halaycı",
      throne: "HALAYBAŞI", star: "ŞAMPİYON", brideLbl: "GELİN", groomLbl: "DAMAT",
      emptyThrone: "👑 TAHT BOŞ", emptySeat: "Koltuk Boş",
      brideHint: "👰 Gelin Koltuğu", groomHint: "🤵 Damat Koltuğu", throneHint: "👑 Meydan Lideri",
      roundTag: "{n}. DÜĞÜN", pJoin: "KATIL➔Gir",
      p1: "Kız Stil", p2: "Efe Stil", pCity: "Şehir Yaz", pDj: "Şarkı Seç",
      djKey: '"!istek"',
      djCallout: '🎧 Canlı DJ Kabini: !istek <Şarkı> • 🇷🇺 !трек • 🇬🇧 !song • 🇸🇦 !أغنية',
      costumeGirlOk: "👗 Kız kostümü kuşanıldı!", costumeBoyOk: "🕺 Efe kostümü kuşanıldı!",
      djLockHint: "🎧 DJ kabini VIP Davulcu ve Halaybaşı rollerine açık!",
      bgLockHint: "👰🤵 Gelin & Damat rolleri özel sahne desteğiyle açılır!",
      afkDropHint: "enerjisi bittiği için halaydan düştü 💤",
      leftRoomHint: "odadan çıktığı için halaydan ayrıldı 🚪",
      vipBumpHint: "sahne sırası güncellendi ⚡",
      queueWaitHint: "🪑 Sahne dolu! Sıradasın (#{pos}) — yer açılınca sırayla girersin!",
      queueNextHint: "⏳ Sırada ilk: @{nick} — bir sonraki koltuk senin! (#{q} kişi bekliyor)",
      spotlights: [
        { pill: "join", text: "🪑 24 Koltuk! Sahnede yer kapmak için KATIL veya ME yaz — doluysa sıraya geçersin!" },
        { pill: "girl", text: "👗 Kız kostümü için 1, 🕺 Efe kostümü için 2 yaz!" },
        { pill: "bride_groom", text: "👰 Gelin, 🤵 Damat & 👑 Halaybaşı sahnenin en ön sırasında yer alır!" },
        { pill: "city", text: "🏙️ Şehrini öne geçir: Plakanı veya şehrini yaz (34, 06, 21) — Memleket yarışı!" },
        { pill: "", text: "⚡ 90sn Enerji & Ön Sıra Yarışı: Beğen/yaz enerjin bitmesin! AFK & odadan çıkan düşer, skor kasan en öne geçer!" },
        { pill: "dj", text: "🎧 Kendi Dilinde Şarkı: VIP DJ'ler için '!istek <Şarkı>' • 🇷🇺 '!трек' • 🇬🇧 '!song'!" }
      ],
      roundWinSub: "🏆 {n}. Düğün Şampiyonu! Yeni düğün turu başladı!",
      menu: [
        ["✨ Konfeti Şöleni", "Sahne Enerjisi"],
        ["🥁 Davulcu + DJ", "VIP Müzik Kabini"],
        ["👑 Halaybaşı Tahtı", "Meydan Lideri"],
        ["🎺 Zurnacı Şovu", "Şok Dalgası"],
        ["👰 Gelin • 🤵 Damat", "Düğün Başrolleri"],
        ["🪩 Disko Kralı", "Gece Neon Şov"]
      ],
      vsWorldL: "TR", vsWorldR: "DÜNYA 🌍", vsCityFbL: "🏙️ 34 İSTANBUL", vsCityFbR: "06 ANKARA 🏛️",
      vsBride: "👰 KIZ EVİ", vsGroom: "DAMAT EVİ 🤵", joined: "halay halkasına katıldı! 🕺",
      extraJoin: "+{n} kişi halay halkasına katıldı! 🕺", energyBurst: "meydan coşkusunu ateşledi! 🎉",
      energyProg: "⚡ {n}/{m} Enerji! (Katılıma {r})", leader300: "Meydanı coşturdu! 🔥",
      follow: "takip etti ⭐", share: "yayını paylaştı 🚀", djMeta: "🎧 MEYDAN DJ",
      fxGiantBadge: "🦖 DEV BÖCEK", fxGiantSub: "45 saniye 2x DEV BÖCEK oldu! 🔥",
      fxShockBadge: "⚡ ŞOK DALGASI", fxShockSub: "Tüm meydanı havaya zıplattı! 💥",
      fxDiscoBadge: "🪩 NEON DİSKO", fxDiscoSub: "45 saniye GECE DİSKO MODU başladı! 🌈",
      fxCityBadge: "🏆 MEMLEKET LİDERİ", fxCitySub: "Şehir yarışında 1. sırada! 🔥",
      champFb: "Şampiyon", stageFb: "Meydan", guestFb: "Misafir",
      roles: {
        katil: ["MEYDAN", "Halay Halkasına Katıldı! 🕺"],
        konfeti: ["KUTLAMA", "Meydanda Konfeti & Havai Fişek! ✨"],
        davulcu: ["DAVULCU", "Davulcu Oldu + VIP DJ Açıldı! 🥁"],
        halaybasi: ["HALAYBAŞI", "Halaybaşı Tahtına Oturdu! 👑"],
        zurnaci: ["ZURNACI", "Meydan Zurnacısı Oldu! 🎺"],
        damat: ["DAMAT", "Düğün Damadı Seçildi! 🤵"],
        gelin: ["GELİN", "Düğün Gelini Seçildi! 👰"],
        parasac: ["DÜĞÜN KRALI", "Meydanda Disko & Şov Başlattı! 🪩"]
      }
    },
    en: {
      flag: "🇬🇧", code: "EN", stageTitle: "LIVE HALAY ARENA", dancerUnit: "Dancers",
      throne: "STAGE KING", star: "CHAMPION", brideLbl: "BRIDE", groomLbl: "GROOM",
      emptyThrone: "👑 THRONE OPEN", emptySeat: "Seat Open",
      brideHint: "👰 Bride Seat", groomHint: "🤵 Groom Seat", throneHint: "👑 Stage King",
      roundTag: "ROUND {n}", pJoin: "JOIN➔Enter",
      p1: "Girl Look", p2: "Boy Look", pCity: "City Code", pDj: "Pick Song",
      djKey: '"!song"',
      djCallout: '🎧 Live DJ Booth: !song <Title> • 🇹🇷 !istek • 🇷🇺 !трек • 🇸🇦 !أغنية',
      costumeGirlOk: "👗 Girl outfit equipped!", costumeBoyOk: "🕺 Boy outfit equipped!",
      djLockHint: "🎧 DJ booth is open for VIP Drummer & Stage King roles!",
      bgLockHint: "👰🤵 Bride & Groom roles unlock with special stage support!",
      afkDropHint: "ran out of 90s stamina and left the ring 💤",
      leftRoomHint: "left the room and exited the dance 🚪",
      vipBumpHint: "stage queue updated ⚡",
      queueWaitHint: "🪑 Stage full! Waiting at #{pos} — you enter next when a spot opens!",
      queueNextHint: "⏳ Next up: @{nick} — next open seat is yours! ({q} waiting)",
      spotlights: [
        { pill: "join", text: "🪑 24 Seats Only! Type JOIN or ME to enter — if full, you join the live queue!" },
        { pill: "boy", text: "👗 Type '1' for Girl look or '2' for Boy suit anytime!" },
        { pill: "bride_groom", text: "👰 Bride, 🤵 Groom & 👑 Stage King lead the front row of the dance!" },
        { pill: "city", text: "🏙️ Rep your city or squad: type '34', '06', or 'girl/boy' to push the live battle bar!" },
        { pill: "", text: "⚡ 90s Energy & Front Row Race: Tap/chat to stay in! AFK & leavers drop out, top scorers move up front!" },
        { pill: "dj", text: "🎧 Play Music in Any Language: VIPs can queue songs with '!song <Title>' or '!трек'!" }
      ],
      roundWinSub: "🏆 Round {n} Champion! Fresh wedding round started!",
      menu: [
        ["✨ Confetti Burst", "Stage Energy"],
        ["🥁 Drummer + DJ", "VIP Music Booth"],
        ["👑 Stage King", "Lead Throne"],
        ["🎺 Zurna Show", "Shockwave FX"],
        ["👰 Bride • 🤵 Groom", "Wedding Stars"],
        ["🪩 Disco King", "Neon Night Show"]
      ],
      vsWorldL: "TR", vsWorldR: "WORLD 🌍", vsCityFbL: "🏙️ ISTANBUL", vsCityFbR: "LONDON 🌍",
      vsBride: "👰 BRIDE", vsGroom: "GROOM 🤵", joined: "joined the dance ring! 🕺",
      extraJoin: "+{n} viewers joined the dance ring! 🕺", energyBurst: "ignited the dance floor! 🎉",
      energyProg: "⚡ {n}/{m} Energy! ({r} left)", leader300: "Lit up the dance arena! 🔥",
      follow: "followed ⭐", share: "shared the stage 🚀", djMeta: "🎧 LIVE DJ",
      fxGiantBadge: "🦖 GIANT BOSS", fxGiantSub: "Transformed into 2x GIANT for 45s! 🔥",
      fxShockBadge: "⚡ SHOCKWAVE", fxShockSub: "Launched the whole floor in the air! 💥",
      fxDiscoBadge: "🪩 NEON DISCO", fxDiscoSub: "45s NEON DISCO MODE activated! 🌈",
      fxCityBadge: "🏆 TOP REGION", fxCitySub: "Leading the city board right now! 🔥",
      champFb: "Champion", stageFb: "Arena", guestFb: "Guest",
      roles: {
        katil: ["ARENA", "Joined the Dance Circle! 🕺"],
        konfeti: ["PARTY", "Fireworks & Confetti Show! ✨"],
        davulcu: ["DRUMMER", "Became Drummer + VIP DJ! 🥁"],
        halaybasi: ["STAGE KING", "Claimed the Stage King Crown! 👑"],
        zurnaci: ["MAESTRO", "Became Stage Maestro! 🎺"],
        damat: ["GROOM", "Crowned Wedding Groom! 🤵"],
        gelin: ["BRIDE", "Crowned Wedding Bride! 👰"],
        parasac: ["DISCO KING", "Started Neon Disco Parade! 🪩"]
      }
    },
    ru: {
      flag: "🇷🇺", code: "RU", stageTitle: "СВАДЕБНЫЙ ТАНЕЦ", dancerUnit: "Танцоры",
      throne: "КОРОЛЬ", star: "ЧЕМПИОН", brideLbl: "НЕВЕСТА", groomLbl: "ЖЕНИХ",
      emptyThrone: "👑 ТРОН СВОБОДЕН", emptySeat: "Свободно",
      brideHint: "👰 Место Невесты", groomHint: "🤵 Место Жениха", throneHint: "👑 Король Сцены",
      roundTag: "СВАДЬБА {n}", pJoin: "ВХОД➔Вход",
      p1: "Девушка", p2: "Парень", pCity: "Твой Город", pDj: "Трек DJ",
      djKey: '"!трек"',
      djCallout: '🎧 Живой DJ-Пульт: !трек <Песня> • 🇹🇷 !istek • 🇬🇧 !song',
      costumeGirlOk: "👗 Костюм девушки надет!", costumeBoyOk: "🕺 Костюм парня надет!",
      djLockHint: "🎧 Пульт DJ открыт для VIP Барабанщика и Короля Сцены!",
      bgLockHint: "👰🤵 Роли Невесты и Жениха открываются особой поддержкой сцены!",
      afkDropHint: "потерял(а) энергию (90с) и выбыл(а) из круга 💤",
      leftRoomHint: "вышел(а) из эфира и покинул(а) танец 🚪",
      vipBumpHint: "очередь сцены обновлена ⚡",
      queueWaitHint: "🪑 Сцена полна! Вы в очереди (#{pos}) — скоро освободится место!",
      queueNextHint: "⏳ Следующий: @{nick} — следующее место твоё! (в очереди: {q})",
      spotlights: [
        { pill: "join", text: "🪑 Всего 24 места! Пиши ВХОД / Я / ME — при заполнении включается живая очередь!" },
        { pill: "girl", text: "👗 Пиши '1' для костюма девушки или '2' для мужского образа!" },
        { pill: "bride_groom", text: "👰 Невеста, 🤵 Жених и 👑 Король ведут первый ряд танцпола!" },
        { pill: "city", text: "🏙️ Битва мира и городов: пиши код города или 'невеста/жених' для шкалы арены!" },
        { pill: "", text: "⚡ Энергия 90с и Первый ряд: Лайкай и пиши, чтобы не вылететь! АФК и вышедшие выбывают, лидеры впереди!" },
        { pill: "dj", text: "🎧 Своя музыка на любом языке: пиши '!трек <Песня>' или '!song' для VIP DJ!" }
      ],
      roundWinSub: "🏆 Чемпион раунда {n}! Новая свадьба началась!",
      menu: [
        ["✨ Салют Конфетти", "Энергия Сцены"],
        ["🥁 Барабан + DJ", "VIP Музыка"],
        ["👑 Король Сцены", "Главный Трон"],
        ["🎺 Зурна + Шок", "Волна Эффекта"],
        ["👰 Невеста • 🤵 Жених", "Звёзды Свадьбы"],
        ["🪩 Диско Король", "Неоновое Шоу"]
      ],
      vsWorldL: "TR", vsWorldR: "МИР 🌍", vsCityFbL: "🏙️ СТАМБУЛ", vsCityFbR: "МОСКВА 🏛️",
      vsBride: "👰 НЕВЕСТА", vsGroom: "ЖЕНИХ 🤵", joined: "вошёл в круг танца! 🕺",
      extraJoin: "+{n} зрителей в круге танца! 🕺", energyBurst: "зажёг всю арену! 🎉",
      energyProg: "⚡ {n}/{m} Энергия! (ост. {r})", leader300: "Зажёг весь танцпол! 🔥",
      follow: "подписался ⭐", share: "поделился эфиром 🚀", djMeta: "🎧 ДИДЖЕЙ СЦЕНЫ",
      fxGiantBadge: "🦖 ГИГАНТ СЦЕНЫ", fxGiantSub: "Вырос в 2x ГИГАНТА на 45 сек! 🔥",
      fxShockBadge: "⚡ УДАРНАЯ ВОЛНА", fxShockSub: "Подбросил весь танцпол вверх! 💥",
      fxDiscoBadge: "🪩 НЕОН ДИСКО", fxDiscoSub: "Режим НОЧНОГО ДИСКО на 45 сек! 🌈",
      fxCityBadge: "🏆 ЛИДЕР ГОРОДОВ", fxCitySub: "Сейчас на 1-м месте в битве! 🔥",
      champFb: "Чемпион", stageFb: "Сцена", guestFb: "Гость",
      roles: {
        katil: ["СЦЕНА", "Присоединился к танцу! 🕺"],
        konfeti: ["САЛЮТ", "Салют и конфетти на арене! ✨"],
        davulcu: ["БАРАБАН", "Стал Барабанщиком + DJ! 🥁"],
        halaybasi: ["ЛИДЕР", "Занял трон Короля танца! 👑"],
        zurnaci: ["МАЭСТРО", "Стал главным музыкантом! 🎺"],
        damat: ["ЖЕНИХ", "Выбран Женихом вечера! 🤵"],
        gelin: ["НЕВЕСТА", "Выбрана Невестой вечера! 👰"],
        parasac: ["ДИСКО КОРОЛЬ", "Запустил Неон Диско шоу! 🪩"]
      }
    },
    ar: {
      flag: "🇸🇦", code: "AR", stageTitle: "ساحة الرقص المباشر", dancerUnit: "راقصون",
      throne: "ملك الساحة", star: "البطل", brideLbl: "العروس", groomLbl: "العريس",
      emptyThrone: "👑 العرش شاغر", emptySeat: "مقعد شاغر",
      brideHint: "👰 مقعد العروس", groomHint: "🤵 مقعد العريس", throneHint: "👑 ملك المسرح",
      roundTag: "جولة {n}", pJoin: "دخول➔دخول",
      p1: "زي فتاة", p2: "زي شاب", pCity: "مدينتك", pDj: "اختر أغنية",
      djKey: '"!أغنية"',
      djCallout: '🎧 ركن الدي جي المباشر: !أغنية <الاسم> • 🇹🇷 !istek • 🇷🇺 !трек • 🇬🇧 !song',
      costumeGirlOk: "👗 تم اختيار زي الفتاة!", costumeBoyOk: "🕺 تم اختيار زي الشاب!",
      djLockHint: "🎧 منصة الـ DJ متاحة لأدوار الطبال وملك المسرح!",
      bgLockHint: "👰🤵 أدوار العروس والعريس تفتح بدعم خاص على المسرح!",
      afkDropHint: "نفدت طاقته (90ث) وخرج من الحلقة 💤",
      leftRoomHint: "غادر البث وخرج من الرقص 🚪",
      vipBumpHint: "تم تحديث ترتيب المسرح ⚡",
      queueWaitHint: "🪑 المسرح ممتلئ! دورك (#{pos}) — ستدخل عند توفر مقعد!",
      queueNextHint: "⏳ التالي في الدور: @{nick} — المقعد القادم لك! ({q} بالانتظار)",
      spotlights: [
        { pill: "join", text: "🪑 24 مقعدًا فقط! اكتب KATIL أو ME للدخول — وعند الامتلاء تدخل قائمة الانتظار!" },
        { pill: "girl", text: "👗 اكتب '1' لزي الفتاة أو '2' لزي الشاب في أي لحظة!" },
        { pill: "bride_groom", text: "👰 العروس و🤵 العريس و👑 الملك يتصدرون الصف الأمامي!" },
        { pill: "city", text: "🏙️ تحدي المدن والفرق: اكتب رقم مدينتك لدعم فريقك على الشريط!" },
        { pill: "", text: "⚡ طاقة 90ث والصف الأمامي: تفاعل لتبقى! الخامل ومن يغادر البث يخرج، والأعلى نقاطًا يتقدم!" },
        { pill: "dj", text: "🎧 موسيقى بلغتك: اطلب أغنيتك عبر '!أغنية <الاسم>' أو '!song' لنجوم الـ VIP!" }
      ],
      roundWinSub: "🏆 بطل الجولة {n}! بدأت جولة جديدة!",
      menu: [
        ["✨ عرض الألعاب النارية", "طاقة الساحة"],
        ["🥁 الطبال + DJ", "منصة الموسيقى"],
        ["👑 ملك المسرح", "عرش القيادة"],
        ["🎺 عرض الزرنة", "موجة حماس"],
        ["👰 العروس • 🤵 العريس", "نجوم الحفل"],
        ["🪩 ملك الديسكو", "عرض الليل"]
      ],
      vsWorldL: "TR", vsWorldR: "العالم 🌍", vsCityFbL: "🏙️ إسطنبول", vsCityFbR: "الرياض 🏛️",
      vsBride: "👰 العروس", vsGroom: "العريس 🤵", joined: "انضم إلى حلقة الرقص! 🕺",
      extraJoin: "+{n} انضموا إلى حلقة الرقص! 🕺", energyBurst: "أشعل حماس الساحة! 🎉",
      energyProg: "⚡ {n}/{m} طاقة! (بقي {r})", leader300: "أشعل الساحة بحماس! 🔥",
      follow: "تابع البث ⭐", share: "شارك البث 🚀", djMeta: "🎧 منسق الساحة",
      fxGiantBadge: "🦖 عملاق الساحة", fxGiantSub: "أصبح بحجم مضاعف لمدة 45 ثانية! 🔥",
      fxShockBadge: "⚡ موجة صدمة", fxShockSub: "أطلق الجميع في الهواء بحماس! 💥",
      fxDiscoBadge: "🪩 حفلة نيون", fxDiscoSub: "انطلقت إضاءة الديسكو الليلية 45 ثانية! 🌈",
      fxCityBadge: "🏆 متصدر المدن", fxCitySub: "يتصدر منافسة المدن الآن! 🔥",
      champFb: "البطل", stageFb: "الساحة", guestFb: "ضيف",
      roles: {
        katil: ["الساحة", "انضم إلى حلقة الرقص! 🕺"],
        konfeti: ["احتفال", "ألعاب نارية واحتفال كبير! ✨"],
        davulcu: ["الطبال", "أصبح طبال الساحة + الدي جي! 🥁"],
        halaybasi: ["ملك الساحة", "توج ملكًا لحلقة الرقص! 👑"],
        zurnaci: ["المايسترو", "أصبح عازف الساحة الرئيسي! 🎺"],
        damat: ["العريس", "تُوج عريس الحفل! 🤵"],
        gelin: ["العروس", "تُوجت عروس الحفل! 👰"],
        parasac: ["ملك الديسكو", "أطلق العرض الاحتفالي الكبير! 🪩"]
      }
    },
    es: {
      flag: "🇪🇸", code: "ES", stageTitle: "FIESTA HALAY EN VIVO", dancerUnit: "Bailando",
      throne: "REY PISTA", star: "CAMPEÓN", brideLbl: "NOVIA", groomLbl: "NOVIO",
      emptyThrone: "👑 TRONO LIBRE", emptySeat: "Libre",
      brideHint: "👰 Puesto Novia", groomHint: "🤵 Puesto Novio", throneHint: "👑 Rey del Baile",
      roundTag: "RONDA {n}", pJoin: "UNIRSE➔Entrar",
      p1: "Chica", p2: "Chico", pCity: "Tu Ciudad", pDj: "Canción",
      djKey: '"!cancion"',
      djCallout: '🎧 Cabina DJ en Vivo: !cancion <Título> • 🇹🇷 !istek • 🇬🇧 !song',
      costumeGirlOk: "👗 ¡Traje de chica listo!", costumeBoyOk: "🕺 ¡Traje de chico listo!",
      djLockHint: "🎧 ¡Cabina DJ abierta para Tamborilero VIP y Rey del Baile!",
      bgLockHint: "👰🤵 ¡Los roles de Novia y Novio se activan con apoyo especial!",
      afkDropHint: "se quedó sin energía (90s) y salió del baile 💤",
      leftRoomHint: "salió de la sala y dejó el baile 🚪",
      vipBumpHint: "orden del escenario actualizado ⚡",
      queueWaitHint: "🪑 ¡Escenario lleno! Estás en cola (#{pos}) — ¡entras al abrirse lugar!",
      queueNextHint: "⏳ Siguiente en fila: @{nick} — ¡el próximo puesto es tuyo! ({q} esperando)",
      spotlights: [
        { pill: "join", text: "🪑 ¡Solo 24 plazas! Escribe YO o ME para entrar — si está lleno vas a la cola!" },
        { pill: "girl", text: "👗 Escribe '1' para Chica o '2' para Chico en el escenario!" },
        { pill: "bride_groom", text: "👰 ¡Novia, 🤵 Novio y 👑 Rey lideran la primera fila del baile!" },
        { pill: "city", text: "🏙️ ¡Duelo de ciudades y equipos! Escribe tu código (34/06) en el chat!" },
        { pill: "", text: "⚡ Energía 90s y Primera Fila: ¡Comenta o da likes! Quien sale o queda AFK cae, ¡los líderes pasan al frente!" },
        { pill: "dj", text: "🎧 Tu música en vivo: '!cancion <Título>' o '!song' para VIP DJ!" }
      ],
      roundWinSub: "🏆 ¡Campeón Ronda {n}! ¡Nueva ronda iniciada!",
      menu: [
        ["✨ Lluvia Confeti", "Energía Escena"],
        ["🥁 Tambor + DJ", "Cabina VIP"],
        ["👑 Rey del Baile", "Trono Líder"],
        ["🎺 Show Zurna", "Onda Choque"],
        ["👰 Novia • 🤵 Novio", "Estrellas Boda"],
        ["🪩 Rey Disco", "Show Neón"]
      ],
      vsWorldL: "TR", vsWorldR: "MUNDO 🌍", vsCityFbL: "🏙️ ESTAMBUL", vsCityFbR: "MADRID 🏛️",
      vsBride: "👰 NOVIA", vsGroom: "NOVIO 🤵", joined: "entró al círculo de baile! 🕺",
      extraJoin: "+{n} entraron al círculo! 🕺", energyBurst: "encendió toda la pista! 🎉",
      energyProg: "⚡ {n}/{m} Energía! (faltan {r})", leader300: "¡Encendió toda la pista! 🔥",
      follow: "siguió ⭐", share: "compartió 🚀", djMeta: "🎧 DJ EN VIVO",
      fxGiantBadge: "🦖 GIGANTE", fxGiantSub: "¡Modo GIGANTE 2x por 45s! 🔥",
      fxShockBadge: "⚡ ONDA", fxShockSub: "¡Hizo saltar a toda la pista! 💥",
      fxDiscoBadge: "🪩 DISCO NEÓN", fxDiscoSub: "¡Modo FIESTA NEÓN por 45s! 🌈",
      fxCityBadge: "🏆 LÍDER CIUDAD", fxCitySub: "¡Liderando el duelo ahora! 🔥",
      champFb: "Campeón", stageFb: "Pista", guestFb: "Invitado",
      roles: {
        katil: ["PISTA", "¡Se unió al baile! 🕺"],
        konfeti: ["FIESTA", "¡Show de confeti y luces! ✨"],
        davulcu: ["TAMBOR", "¡Tamborilero + VIP DJ! 🥁"],
        halaybasi: ["REY PISTA", "¡Nuevo Rey de la pista! 👑"],
        zurnaci: ["MAESTRO", "¡Maestro musical en vivo! 🎺"],
        damat: ["NOVIO", "¡Elegido Novio de gala! 🤵"],
        gelin: ["NOVIA", "¡Elegida Novia de gala! 👰"],
        parasac: ["REY DISCO", "¡Desfile espectacular! 🪩"]
      }
    },
    de: {
      flag: "🇩🇪", code: "DE", stageTitle: "LIVE HALAY ARENA", dancerUnit: "Tänzer",
      throne: "KÖNIG", star: "CHAMPION", brideLbl: "BRAUT", groomLbl: "BRÄUTIGAM",
      emptyThrone: "👑 THRON FREI", emptySeat: "Platz Frei",
      brideHint: "👰 Braut-Platz", groomHint: "🤵 Bräutigam", throneHint: "👑 Tanz-König",
      roundTag: "RUNDE {n}", pJoin: "START➔Start",
      p1: "Girl-Look", p2: "Boy-Look", pCity: "Stadtcode", pDj: "Songwahl",
      djKey: '"!lied"',
      djCallout: '🎧 Live DJ-Pult: !lied <Titel> • 🇹🇷 !istek • 🇷🇺 !трек • 🇬🇧 !song',
      costumeGirlOk: "👗 Girl-Outfit aktiviert!", costumeBoyOk: "🕺 Boy-Outfit aktiviert!",
      djLockHint: "🎧 DJ-Pult offen für VIP-Trommler & Tanz-König!",
      bgLockHint: "👰🤵 Braut & Bräutigam Plätze öffnen durch besondere Bühnenhilfe!",
      afkDropHint: "verlor 90s Energie und verließ den Kreis 💤",
      leftRoomHint: "hat den Raum verlassen 🚪",
      vipBumpHint: "Bühnen-Reihenfolge aktualisiert ⚡",
      queueWaitHint: "🪑 Bühne voll! Warteliste #{pos} — du rückst nach sobald frei wird!",
      queueNextHint: "⏳ Als Nächster dran: @{nick} — nächster Platz gehört dir! ({q} warten)",
      spotlights: [
        { pill: "join", text: "🪑 Nur 24 Plätze! Schreib MITMACHEN oder ME — voll = Live-Warteliste!" },
        { pill: "boy", text: "👗 Schreib '1' für Girl-Look oder '2' für Boy-Look!" },
        { pill: "bride_groom", text: "👰 Braut, 🤵 Bräutigam & 👑 Tanz-König führen die erste Reihe an!" },
        { pill: "city", text: "🏙️ Städte-Duell: Schreib deinen Stadtcode (34/06) in den Chat!" },
        { pill: "", text: "⚡ 90s Energie & Erste Reihe: Aktiv bleiben! AFK & Raum-Verlasser fliegen, Top-Scorer rücken nach vorn!" },
        { pill: "dj", text: "🎧 Musikwunsch: '!lied <Titel>' oder '!song' für VIP DJs!" }
      ],
      roundWinSub: "🏆 Runde {n} Champion! Neue Runde gestartet!",
      menu: [
        ["✨ Konfetti-Show", "Bühnen-Energie"],
        ["🥁 Trommel + DJ", "VIP-Musikpult"],
        ["👑 Tanz-König", "Hauptthron"],
        ["🎺 Zurna-Show", "Schockwelle"],
        ["👰 Braut • 🤵 Bräutigam", "Hochzeits-Stars"],
        ["🪩 Disco-König", "Neon-Show"]
      ],
      vsWorldL: "TR", vsWorldR: "WELT 🌍", vsCityFbL: "🏙️ ISTANBUL", vsCityFbR: "BERLIN 🏛️",
      vsBride: "👰 BRAUT", vsGroom: "BRÄUTIGAM 🤵", joined: "tanzt jetzt im Kreis mit! 🕺",
      extraJoin: "+{n} neue Tänzer im Kreis! 🕺", energyBurst: "hat die Bühne gerockt! 🎉",
      energyProg: "⚡ {n}/{m} Energie! (noch {r})", leader300: "Hat die Bühne gerockt! 🔥",
      follow: "folgt ⭐", share: "teilte Live 🚀", djMeta: "🎧 LIVE DJ",
      fxGiantBadge: "🦖 RIESEN-STAR", fxGiantSub: "45s lang 2x RIESEN-MODUS! 🔥",
      fxShockBadge: "⚡ SCHOCKWELLE", fxShockSub: "Alle Tänzer springen hoch! 💥",
      fxDiscoBadge: "🪩 NEON DISKO", fxDiscoSub: "45s NEON-NACHT-MODUS aktiv! 🌈",
      fxCityBadge: "🏆 TOP STADT", fxCitySub: "Führt das Städte-Duell an! 🔥",
      champFb: "Champion", stageFb: "Arena", guestFb: "Gast",
      roles: {
        katil: ["ARENA", "Ist im Tanzkreis! 🕺"],
        konfeti: ["PARTY", "Konfetti- & Lichtershow! ✨"],
        davulcu: ["TROMMLER", "Trommler + VIP DJ aktiv! 🥁"],
        halaybasi: ["TANZ-KÖNIG", "Übernimmt die Spitze! 👑"],
        zurnaci: ["MAESTRO", "Neuer Musik-Maestro! 🎺"],
        damat: ["BRÄUTIGAM", "Zum Bräutigam gekrönt! 🤵"],
        gelin: ["BRAUT", "Zur Braut gekrönt! 👰"],
        parasac: ["DISKO KÖNIG", "Startet die große Parade! 🪩"]
      }
    },
    fr: {
      flag: "🇫🇷", code: "FR", stageTitle: "ARÈNE HALAY LIVE", dancerUnit: "Danseurs",
      throne: "ROI SCÈNE", star: "CHAMPION", brideLbl: "MARIÉE", groomLbl: "MARIÉ",
      emptyThrone: "👑 TRÔNE LIBRE", emptySeat: "Place Libre",
      brideHint: "👰 Place Mariée", groomHint: "🤵 Place Marié", throneHint: "👑 Roi Scène",
      roundTag: "MANCHE {n}", pJoin: "ENTRER➔Entrer",
      p1: "Tenue Fille", p2: "Tenue Gars", pCity: "Ta Ville", pDj: "Musique",
      djKey: '"!chanson"',
      djCallout: '🎧 Cabine DJ Live: !chanson <Titre> • 🇹🇷 !istek • 🇷🇺 !трек • 🇬🇧 !song',
      costumeGirlOk: "👗 Tenue fille équipée !", costumeBoyOk: "🕺 Tenue garçon équipée !",
      djLockHint: "🎧 Cabine DJ ouverte aux rôles VIP Tambour & Roi de Scène !",
      bgLockHint: "👰🤵 Les rôles Mariée & Marié s'ouvrent avec un soutien spécial !",
      afkDropHint: "a épuisé son énergie (90s) et quitté la danse 💤",
      leftRoomHint: "a quitté le live et la piste 🚪",
      vipBumpHint: "ordre de la scène mis à jour ⚡",
      queueWaitHint: "🪑 Scène pleine ! File d'attente #{pos} — tu entres dès qu'une place s'ouvre !",
      queueNextHint: "⏳ Prochain en file : @{nick} — prochaine place pour toi ! ({q} en attente)",
      spotlights: [
        { pill: "join", text: "🪑 24 Places max ! Écris MOI ou ME pour entrer — si plein, file d'attente en direct !" },
        { pill: "girl", text: "👗 Écris '1' pour Tenue Fille ou '2' pour Tenue Garçon !" },
        { pill: "bride_groom", text: "👰 Mariée, 🤵 Marié & 👑 Roi mènent le premier rang de la danse !" },
        { pill: "city", text: "🏙️ Duel Villes & Monde : tape ton code ville dans le chat !" },
        { pill: "", text: "⚡ Énergie 90s & Premier Rang : Reste actif ! AFK et départs sortent, les meilleurs passent devant !" },
        { pill: "dj", text: "🎧 Ta musique en live : '!chanson <Titre>' ou '!song' pour les VIP !" }
      ],
      roundWinSub: "🏆 Champion Manche {n} ! Nouvelle manche lancée !",
      menu: [
        ["✨ Pluie Confettis", "Énergie Scène"],
        ["🥁 Tambour + DJ", "Cabine VIP"],
        ["👑 Roi de Scène", "Trône Leader"],
        ["🎺 Show Zurna", "Onde de Choc"],
        ["👰 Mariée • 🤵 Marié", "Stars du Bal"],
        ["🪩 Roi Disco", "Show Néon"]
      ],
      vsWorldL: "TR", vsWorldR: "MONDE 🌍", vsCityFbL: "🏙️ ISTANBUL", vsCityFbR: "PARIS 🏛️",
      vsBride: "👰 MARIÉE", vsGroom: "MARIÉ 🤵", joined: "a rejoint le cercle! 🕺",
      extraJoin: "+{n} dans le cercle! 🕺", energyBurst: "a enflammé la piste! 🎉",
      energyProg: "⚡ {n}/{m} Énergie! (reste {r})", leader300: "A enflammé la scène ! 🔥",
      follow: "suit ⭐", share: "a partagé 🚀", djMeta: "🎧 DJ LIVE",
      fxGiantBadge: "🦖 GÉANT", fxGiantSub: "Mode GÉANT 2x pendant 45s! 🔥",
      fxShockBadge: "⚡ ONDE", fxShockSub: "Toute la piste décolle! 💥",
      fxDiscoBadge: "🪩 DISCO NÉON", fxDiscoSub: "Ambiance NÉON DISCO 45s! 🌈",
      fxCityBadge: "🏆 VILLE #1", fxCitySub: "En tête du classement! 🔥",
      champFb: "Champion", stageFb: "Scène", guestFb: "Invité",
      roles: {
        katil: ["ARÈNE", "A rejoint la danse! 🕺"],
        konfeti: ["FÊTE", "Pluie de confettis & feux! ✨"],
        davulcu: ["TAMBOUR", "Tambour principal + DJ VIP! 🥁"],
        halaybasi: ["ROI SCÈNE", "Prend la tête du cercle! 👑"],
        zurnaci: ["MAESTRO", "Nouveau maestro musical! 🎺"],
        damat: ["MARIÉ", "Couronné Marié du soir! 🤵"],
        gelin: ["MARIÉE", "Couronnée Mariée du soir! 👰"],
        parasac: ["ROI DISCO", "Lance la grande parade! 🪩"]
      }
    },
    az: {
      flag: "🇦🇿", code: "AZ", stageTitle: "CANLI HALAY MEYDANI", dancerUnit: "Rəqqas",
      throne: "HALAYBAŞI", star: "ÇEMPİON", brideLbl: "GƏLİN", groomLbl: "BƏY",
      emptyThrone: "👑 TAXT BOŞDUR", emptySeat: "Yer Boşdur",
      brideHint: "👰 Gəlin Taxtı", groomHint: "🤵 Bəy Taxtı", throneHint: "👑 Meydan Lideri",
      roundTag: "{n}. TOY", pJoin: "KATIL➔Gir",
      p1: "Qız Stil", p2: "Bəy Stil", pCity: "Şəhər Yaz", pDj: "Mahnı Seç",
      djKey: '"!mahni"',
      djCallout: '🎧 Canlı DJ Kabini: !mahni <Ad> • 🇹🇷 !istek • 🇷🇺 !трек • 🇬🇧 !song',
      costumeGirlOk: "👗 Qız kostyumu seçildi!", costumeBoyOk: "🕺 Bəy kostyumu seçildi!",
      djLockHint: "🎧 DJ kabini VIP Nağaraçı və Halaybaşı rollarına açıqdır!",
      bgLockHint: "👰🤵 Gəlin & Bəy rolları xüsusi səhnə dəstəyi ilə açılır!",
      afkDropHint: "enerjisi bitdiyi üçün halaydan düşdü 💤",
      leftRoomHint: "otaqdan çıxdığı üçün halaydan ayrıldı 🚪",
      vipBumpHint: "səhnə sırası yeniləndi ⚡",
      queueWaitHint: "🪑 Səhnə doludur! Növbədəsən (#{pos}) — yer açılan kimi girəcəksən!",
      queueNextHint: "⏳ Növbədə ilk: @{nick} — növbəti boş yer sənindir! ({q} gözləyir)",
      spotlights: [
        { pill: "join", text: "🪑 24 Yer Limiti! Səhnəyə girmək üçün KATIL və ya MƏN yaz — doludursa növbəyə keç!" },
        { pill: "girl", text: "👗 Qız stili üçün '1', 🕺 Bəy stili üçün '2' yaz!" },
        { pill: "bride_groom", text: "👰 Gəlin, 🤵 Bəy & 👑 Halaybaşı səhnənin ön sırasında yer alır!" },
        { pill: "city", text: "🏙️ Şəhər yarışını qazan: kodunu və ya 'gəlin/bəy' yaz!" },
        { pill: "", text: "⚡ 90sn Enerji & Ön Sıra Yarışı: Aktiv qal! AFK və otaqdan çıxan düşür, xal yığan önə keçir!" },
        { pill: "dj", text: "🎧 Öz Dilində Mahnı: VIP DJ üçün '!mahni <Ad>' və ya '!трек'!" }
      ],
      roundWinSub: "🏆 {n}. Toy Çempionu! Yeni toy başladı!",
      menu: [
        ["✨ Konfeti Şousu", "Səhnə Enerjisi"],
        ["🥁 Nağara + DJ", "VIP Musiqi"],
        ["👑 Halaybaşı Taxtı", "Meydan Lideri"],
        ["🎺 Zurnaçı Şousu", "Şok Dalğası"],
        ["👰 Gəlin • 🤵 Bəy", "Toy Ulduzları"],
        ["🪩 Disko Kralı", "Neon Şou"]
      ],
      vsWorldL: "TR/AZ", vsWorldR: "DÜNYA 🌍", vsCityFbL: "🏙️ BAKU", vsCityFbR: "İSTANBUL 🏛️",
      vsBride: "👰 GƏLİN", vsGroom: "BƏY 🤵", joined: "halay dairəsinə qoşuldu! 🕺",
      extraJoin: "+{n} nəfər halaya qoşuldu! 🕺", energyBurst: "meydanı coşdurdu! 🎉",
      energyProg: "⚡ {n}/{m} Enerji! (qaldı {r})", leader300: "Meydanı coşdurdu! 🔥",
      follow: "izlədi ⭐", share: "paylaşdı 🚀", djMeta: "🎧 MEYDAN DJ",
      fxGiantBadge: "🦖 NƏHƏNG", fxGiantSub: "45 saniyə 2x NƏHƏNG oldu! 🔥",
      fxShockBadge: "⚡ ŞOK DALĞASI", fxShockSub: "Bütün meydanı havaya qaldırdı! 💥",
      fxDiscoBadge: "🪩 NEON DİSKO", fxDiscoSub: "45 saniyə GECƏ DİSKO rejimi! 🌈",
      fxCityBadge: "🏆 LİDER ŞƏHƏR", fxCitySub: "Yarışda 1-ci sıradadır! 🔥",
      champFb: "Çempion", stageFb: "Meydan", guestFb: "Qonaq",
      roles: {
        katil: ["MEYDAN", "Halay Dairəsinə Qoşuldu! 🕺"],
        konfeti: ["BAYRAM", "Konfeti və Atəşfəşanlıq! ✨"],
        davulcu: ["NAĞARAÇI", "Nağaraçı + VIP DJ Oldu! 🥁"],
        halaybasi: ["HALAYBAŞI", "Halaybaşı Tacını Aldı! 👑"],
        zurnaci: ["ZURNAÇI", "Meydan Zurnaçısı Oldu! 🎺"],
        damat: ["BƏY", "Toyun Bəyi Seçildi! 🤵"],
        gelin: ["GƏLİN", "Toyun Gəlini Seçildi! 👰"],
        parasac: ["DİSKO KRALI", "Meydanda Şou Başlatdı! 🪩"]
      }
    }
  };

  const HudLangEngine = {
    mode: "auto",
    current: "tr",
    holdUntil: 0,
    lastSwitchTs: 0,
    cycleIdx: 0,
    activeQueue: ["tr", "en", "ru"],
    userLangs: new Map(),
    langCounts: new Map(),

    pack(lang) {
      return HUD_I18N[lang] || HUD_I18N[this.current] || HUD_I18N.tr;
    },

    getUserFlag(uid) {
      const rec = this.userLangs.get(String(uid || ""));
      if (rec?.flag) return rec.flag;
      const vp = viewerProfiles.get(String(uid || ""));
      return vp?.flag || "";
    },

    getUserLang(uid) {
      const rec = this.userLangs.get(String(uid || ""));
      if (rec?.lang) return rec.lang;
      const vp = viewerProfiles.get(String(uid || ""));
      return (vp?.lang && HUD_I18N[vp.lang]) ? vp.lang : this.current;
    },

    setDirectorMode(mode) {
      const m = String(mode || "auto").toLowerCase();
      if (m === "auto") {
        this.mode = "auto";
        this.holdUntil = 0;
      } else if (HUD_I18N[m]) {
        this.mode = m;
        this.switchTo(m, true);
      }
    },

    onViewerLang(uid, lang, flag) {
      const code = HUD_I18N[lang] ? lang : "tr";
      const fl = flag || HUD_I18N[code].flag;
      if (uid) {
        if (this.userLangs.size > 900 && !this.userLangs.has(uid)) {
          const first = this.userLangs.keys().next().value;
          if (first) this.userLangs.delete(first);
        }
        this.userLangs.set(String(uid), { lang: code, flag: fl });
      }
      const nextCnt = (this.langCounts.get(code) || 0) + 1;
      this.langCounts.set(code, nextCnt);
      const eligible = code === "tr" || code === "en" || code === "ru" || nextCnt >= 3;
      if (eligible && !this.activeQueue.includes(code)) {
        this.activeQueue.unshift(code);
        if (this.activeQueue.length > 6) this.activeQueue.pop();
      }
      if (this.mode === "auto" && eligible) {
        const now = Date.now();
        if (code !== this.current && now - this.lastSwitchTs >= 3500) {
          this.switchTo(code, false);
          this.holdUntil = now + 11000;
        }
      }
    },

    switchTo(lang, immediate = false) {
      const code = HUD_I18N[lang] ? lang : "tr";
      this.current = code;
      this.lastSwitchTs = Date.now();
      TopDock?.applyLanguage?.(code, immediate);
    },

    tickRotate() {
      if (this.mode !== "auto") return;
      const now = Date.now();
      if (now < this.holdUntil || now - this.lastSwitchTs < 10500) return;
      this.cycleIdx = (this.cycleIdx + 1) % this.activeQueue.length;
      const next = this.activeQueue[this.cycleIdx] || "tr";
      if (next !== this.current) this.switchTo(next, false);
    }
  };
  window.__halayLang = HudLangEngine;

  // --- 2D 60FPS Weather & Party Particle Engine (Snow / Rain+Lightning / Fireflies / Confetti / Disco) ---
  const StageWeatherEngine = {
    canvas: null,
    ctx: null,
    mode: "clear",
    particles: [],
    rafId: 0,
    discoTimer: 0,
    discoStep: 0,
    lightningAlpha: 0,
    nextLightningTs: 0,

    ensureCanvas() {
      if (this.canvas && document.body?.contains(this.canvas)) return this.canvas;
      if (!document.body) return null;
      let c = document.getElementById("halay-weather-canvas");
      if (!c) {
        c = document.createElement("canvas");
        c.id = "halay-weather-canvas";
        c.style.cssText = "position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:4;";
        document.body.appendChild(c);
      }
      this.canvas = c;
      this.ctx = c.getContext("2d");
      this.resize();
      if (!this._boundResize) {
        this._boundResize = () => this.resize();
        window.addEventListener("resize", this._boundResize);
      }
      return c;
    },

    resize() {
      if (!this.canvas) return;
      const w = Math.max(320, window.innerWidth || 1280);
      const h = Math.max(240, window.innerHeight || 720);
      if (this.canvas.width !== w) this.canvas.width = w;
      if (this.canvas.height !== h) this.canvas.height = h;
    },

    setMode(mode) {
      const next = ["clear", "snow", "rain", "fireflies", "confetti", "disco"].includes(mode) ? mode : "clear";
      if (this.mode === next && (next === "clear" || this.rafId)) return;
      this.mode = next;
      this.particles = [];
      this.lightningAlpha = 0;

      if (this.discoTimer) {
        clearInterval(this.discoTimer);
        this.discoTimer = 0;
      }

      if (next === "clear") {
        if (this.rafId) {
          cancelAnimationFrame(this.rafId);
          this.rafId = 0;
        }
        if (this.ctx && this.canvas) {
          this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }
        StageDirector.applyAtmosphere();
        return;
      }

      const c = this.ensureCanvas();
      if (!c) return;
      const w = c.width || 1280;
      const h = c.height || 720;

      const countMap = { snow: 80, rain: 100, fireflies: 36, confetti: 70, disco: 24 };
      const count = countMap[next] || 60;
      const palette = ["#f43f5e", "#f59e0b", "#10b981", "#38bdf8", "#a855f7", "#fde047"];
      for (let i = 0; i < count; i++) {
        this.particles.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: next === "rain" ? -3.2 - Math.random() * 1.5 : (Math.random() - 0.5) * (next === "confetti" ? 2.4 : 0.9),
          vy: next === "rain" ? 14 + Math.random() * 7 : next === "snow" ? 1.2 + Math.random() * 2.1 : next === "confetti" ? 2.2 + Math.random() * 2.6 : (Math.random() - 0.5) * 0.7,
          size: next === "snow" ? 2 + Math.random() * 3.8 : next === "rain" ? 12 + Math.random() * 14 : next === "confetti" ? 5 + Math.random() * 6 : 2.5 + Math.random() * 3.5,
          phase: Math.random() * Math.PI * 2,
          color: palette[i % palette.length],
          rot: Math.random() * Math.PI * 2,
          vrot: (Math.random() - 0.5) * 0.16
        });
      }

      if (next === "rain") {
        this.nextLightningTs = performance.now() + 2500 + Math.random() * 3500;
      }

      if (next === "disco") {
        const discoHexes = [0xff2d78, 0x38bdf8, 0xfacc15, 0xa855f7, 0x22c55e];
        this.discoTimer = setInterval(() => {
          this.discoStep = (this.discoStep + 1) % discoHexes.length;
          let pIdx = 0;
          for (const item of StageDirector._baseLights) {
            if (item.isPoint && item.light?.color?.setHex) {
              item.light.color.setHex(discoHexes[(this.discoStep + pIdx) % discoHexes.length]);
              item.light.intensity = Math.max(22, item.intensity * 1.45);
              pIdx++;
            }
          }
        }, 260);
      }

      if (!this.rafId) {
        const loop = (now) => {
          if (this.mode === "clear") {
            this.rafId = 0;
            return;
          }
          this.drawFrame(now);
          this.rafId = requestAnimationFrame(loop);
        };
        this.rafId = requestAnimationFrame(loop);
      }
    },

    drawFrame(now) {
      const ctx = this.ctx;
      const c = this.canvas;
      if (!ctx || !c) return;
      const w = c.width;
      const h = c.height;
      ctx.clearRect(0, 0, w, h);

      if (this.mode === "snow") {
        ctx.fillStyle = "rgba(255,255,255,0.88)";
        for (const p of this.particles) {
          p.phase += 0.025;
          p.x += p.vx + Math.sin(p.phase) * 0.7;
          p.y += p.vy;
          if (p.y > h + 10) { p.y = -10; p.x = Math.random() * w; }
          if (p.x > w + 10) p.x = -10;
          if (p.x < -10) p.x = w + 10;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (this.mode === "rain") {
        if (now >= this.nextLightningTs) {
          this.lightningAlpha = 0.34;
          this.nextLightningTs = now + 3800 + Math.random() * 5200;
        }
        if (this.lightningAlpha > 0.01) {
          ctx.fillStyle = `rgba(210, 232, 255, ${this.lightningAlpha.toFixed(3)})`;
          ctx.fillRect(0, 0, w, h);
          this.lightningAlpha *= 0.84;
        }
        ctx.strokeStyle = "rgba(186, 230, 253, 0.55)";
        ctx.lineWidth = 1.35;
        ctx.beginPath();
        for (const p of this.particles) {
          p.x += p.vx;
          p.y += p.vy;
          if (p.y > h + 20) { p.y = -20; p.x = Math.random() * (w + 120); }
          if (p.x < -20) p.x = w + 20;
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x + p.vx * 1.4, p.y + p.size);
        }
        ctx.stroke();
      } else if (this.mode === "fireflies") {
        for (const p of this.particles) {
          p.phase += 0.04;
          p.x += p.vx + Math.cos(p.phase * 0.7) * 0.45;
          p.y += p.vy + Math.sin(p.phase * 0.9) * 0.35;
          if (p.y < -10) p.y = h + 10;
          if (p.y > h + 10) p.y = -10;
          if (p.x < -10) p.x = w + 10;
          if (p.x > w + 10) p.x = -10;
          const alpha = 0.25 + 0.65 * (0.5 + 0.5 * Math.sin(p.phase));
          ctx.fillStyle = `rgba(250, 224, 95, ${alpha.toFixed(2)})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (this.mode === "confetti") {
        for (const p of this.particles) {
          p.phase += 0.06;
          p.x += p.vx + Math.sin(p.phase) * 0.9;
          p.y += p.vy;
          p.rot += p.vrot;
          if (p.y > h + 12) { p.y = -12; p.x = Math.random() * w; }
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size * 0.5, -p.size * 0.3, p.size, p.size * 0.6);
          ctx.restore();
        }
      } else if (this.mode === "disco") {
        const t = now * 0.0018;
        const beams = [
          { ox: w * 0.12, ang: 0.45 + Math.sin(t) * 0.45, col: "rgba(56, 189, 248, 0.16)" },
          { ox: w * 0.88, ang: -0.45 + Math.cos(t * 1.15) * 0.45, col: "rgba(244, 114, 182, 0.16)" },
          { ox: w * 0.5, ang: Math.sin(t * 0.85) * 0.6, col: "rgba(168, 85, 247, 0.13)" }
        ];
        for (const b of beams) {
          ctx.save();
          ctx.translate(b.ox, -20);
          ctx.rotate(b.ang);
          ctx.fillStyle = b.col;
          ctx.beginPath();
          ctx.moveTo(-14, 0);
          ctx.lineTo(14, 0);
          ctx.lineTo(140, h * 1.35);
          ctx.lineTo(-140, h * 1.35);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
        for (const p of this.particles) {
          p.phase += 0.07;
          p.x += p.vx;
          p.y += Math.sin(p.phase) * 0.6;
          if (p.x > w + 10) p.x = -10;
          if (p.x < -10) p.x = w + 10;
          ctx.fillStyle = p.color;
          ctx.globalAlpha = 0.55;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * 0.8, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
    }
  };
  window.__halayWeather = StageWeatherEngine;

  // --- 3D Stage Director (Live Atmosphere, Venues, Weather & Cinematic Camera Modes) ---
  const StageDirector = {
    atmosphere: "day",
    weather: "auto",
    camera: "auto",
    _droneAngle: 0,
    _baseCaptured: false,
    _baseBg: null,
    _baseBgInt: 1,
    _baseEnvInt: 0.85,
    _baseFogHex: null,
    _baseLights: [],
    _baseTerrain: [],

    captureBaseline(scene) {
      if (this._baseCaptured || !scene) return;
      this._baseCaptured = true;
      this._baseBg = scene.background || null;
      this._baseBgInt = typeof scene.backgroundIntensity === "number" ? scene.backgroundIntensity : 1;
      this._baseEnvInt = typeof scene.environmentIntensity === "number" ? scene.environmentIntensity : 0.85;
      this._baseFogHex = scene.fog?.color?.getHex ? scene.fog.color.getHex() : null;
      this._baseLights = [];
      scene.traverse((o) => {
        if (o.isLight && o.color) {
          this._baseLights.push({
            light: o,
            hex: o.color.getHex(),
            intensity: o.intensity,
            isDir: Boolean(o.isDirectionalLight),
            isHemi: Boolean(o.isHemisphereLight),
            isPoint: Boolean(o.isPointLight),
            groundHex: o.groundColor ? o.groundColor.getHex() : null
          });
        }
      });
      this._baseTerrain = [];
      const m = window.halay?.meydan;
      if (m) {
        const seen = new Set();
        const addMat = (mat, role) => {
          if (!mat || !mat.color?.getHex || seen.has(mat)) return;
          seen.add(mat);
          this._baseTerrain.push({ mat, hex: mat.color.getHex(), role });
        };
        addMat(m.base?.material, "ground");
        addMat(m.ground?.material, "ground");
        if (m.group?.traverse) {
          m.group.traverse((obj) => {
            if (obj === m.floor) return;
            if (obj.isMesh && obj.material) {
              const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
              mats.forEach((mt) => addMat(mt, "env"));
            }
          });
        }
      }
    },

    resolveWeather() {
      if (this.weather && this.weather !== "auto") return this.weather;
      if (this.atmosphere === "snow") return "snow";
      if (this.atmosphere === "rain") return "rain";
      if (this.atmosphere === "night" || this.atmosphere === "sunset") return "fireflies";
      return "clear";
    },

    setState(patch) {
      if (!patch || typeof patch !== "object") return;
      let shouldApplyAtm = false;
      if (patch.atmosphere && ["day", "sunset", "night", "snow", "rain"].includes(patch.atmosphere)) {
        if (this.atmosphere !== patch.atmosphere) shouldApplyAtm = true;
        this.atmosphere = patch.atmosphere;
      }
      if (patch.weather && ["auto", "clear", "snow", "rain", "fireflies", "confetti", "disco"].includes(patch.weather)) {
        this.weather = patch.weather;
        shouldApplyAtm = true;
      }
      if (shouldApplyAtm) {
        this.applyAtmosphere();
        StageWeatherEngine.setMode(this.resolveWeather());
      }
      if (patch.camera && ["auto", "wide", "leader", "drone"].includes(patch.camera)) {
        this.camera = patch.camera;
      }
      if (patch.hud_lang) HudLangEngine.setDirectorMode(patch.hud_lang);
      if (patch.vs_mode && VsArena) {
        VsArena.directorMode = patch.vs_mode;
        VsArena.render();
      }
      const h = window.halay;
      if (!h) return;
      if (patch.figure && ["auto", "ana", "one", "cokme", "kol"].includes(patch.figure) && h.line) {
        try {
          if (patch.figure === "auto") h.line.setAuto?.(true);
          else { h.line.setAuto?.(false); h.line.setFigure?.(patch.figure); }
        } catch (_) {}
      }
      if (patch.floor && ["altigen", "seramik", "kum", "toprak"].includes(patch.floor) && h.meydan) {
        try {
          const prevTheme = this._floorTheme || h.meydan.floorStyle || "altigen";
          if (typeof h.meydan.setFloorStyle === "function" && h.meydan.floorStyle !== "altigen") {
            // Only hexagonal_concrete_paving PBR textures exist on disk; other styles 404 and turn black.
            h.meydan.setFloorStyle("altigen");
          }
          if (h.meydan.floor?.material?.color) {
            const tintMap = { altigen: 0xe8edf5, seramik: 0xbae6fd, kum: 0xfde68a, toprak: 0xd6b08a };
            h.meydan.floor.material.color.setHex(tintMap[patch.floor] || 0xe8edf5);
            h.meydan.floor.material.needsUpdate = true;
          }
          this._floorTheme = patch.floor;
          if (prevTheme !== patch.floor) {
            const floorLabels = { altigen: "⬡ Altıgen Taş", seramik: "🏛️ Seramik", kum: "🏖️ Kumsal", toprak: "🌿 Kır Toprağı" };
            StageScheduler.enqueue({
              priority: 2, kind: "world_fx", template: "micro", accent: "#fde047",
              user: { id: "stage-floor", nickname: "Meydan Zemin", avatar_url: "" },
              text: floorLabels[patch.floor] || patch.floor, dedupKey: `floor:${patch.floor}`, ttl: 2400
            });
          }
        } catch (_) {}
      }
      if (patch.tempo && ["normal", "peak"].includes(patch.tempo) && h.beat && h.tempo) {
        const bpm = patch.tempo === "peak" ? 172 : 144;
        h.beat.bpm = bpm;
        h.tempo.peak = bpm;
      }
      if (typeof patch.davul === "boolean" && h.davul?.toggle) {
        try {
          if (Boolean(h.davul.enabled) !== patch.davul) h.davul.toggle();
        } catch (_) {}
      }
      if (patch.director_seq) {
        try {
          const lead = h.line?.dancers?.[0] || null;
          if (patch.director_seq === "spotlight" && lead) h.director?.spotlight?.(lead);
          else if (patch.director_seq === "celebrate" && lead) h.director?.celebrate?.(lead, h.line?.dancers?.[1] || null);
          else if (patch.director_seq === "para") {
            const paraUser = lead?.viewer?.id ? lead.viewer : { id: "host-para", nickname: "Meydan" };
            if (typeof h.para?.add === "function") h.para.add(buildCanonUser(paraUser), 3, "para");
            if (lead) h.director?.paraShow?.(lead);
          }
          else if (patch.director_seq === "drop") h.director?.dropViewers?.();
          else if (patch.director_seq === "fireworks") {
            if (h.fireworks?.show) h.fireworks.show();
            else StageFxEngine?.trigger?.("confetti", "Meydan", "Havai Fişek");
          } else if (patch.director_seq === "couple_cheer" && Array.isArray(h.couple?.people)) {
            h.couple.people.forEach((p) => h.couple.cheer?.(p));
          }
        } catch (_) {}
      }
    },

    applyAtmosphere() {
      const scene = window.halay?.engine?.scene;
      if (!scene || StageFxEngine._discoTimer) return;
      this.captureBaseline(scene);
      try {
        const setSolidBg = (hex) => {
          const col = scene.fog?.color?.clone?.();
          if (col) {
            col.setHex(hex);
            scene.background = col;
          } else if (scene.background?.setHex) {
            scene.background.setHex(hex);
          }
        };
        const tintTerrain = (groundHex, envHex) => {
          for (const t of this._baseTerrain) {
            t.mat.color.setHex(t.role === "ground" ? groundHex : envHex);
          }
        };

        if (this.atmosphere === "sunset") {
          setSolidBg(0x9a3412);
          if ("backgroundIntensity" in scene) scene.backgroundIntensity = 0.78;
          if ("environmentIntensity" in scene) scene.environmentIntensity = 0.72;
          if (scene.fog?.color?.setHex) scene.fog.color.setHex(0xc96848);
          tintTerrain(0xb45309, 0xd97706);
          let ptIdx = 0;
          for (const item of this._baseLights) {
            if (item.isDir) {
              item.light.color.setHex(0xff8e42);
              item.light.intensity = Math.max(3.0, item.intensity * 1.15);
            } else if (item.isHemi) {
              item.light.color.setHex(0xffb48a);
              if (item.light.groundColor) item.light.groundColor.setHex(0x3a1f3d);
              item.light.intensity = Math.max(0.95, item.intensity);
            } else if (item.isPoint) {
              item.light.color.setHex(ptIdx % 2 === 0 ? 0xffaa44 : 0xff6b8b);
              item.light.intensity = Math.max(16, item.intensity * 1.15);
              ptIdx++;
            }
          }
        } else if (this.atmosphere === "night") {
          setSolidBg(0x16143b);
          if ("backgroundIntensity" in scene) scene.backgroundIntensity = 1.0;
          if ("environmentIntensity" in scene) scene.environmentIntensity = 0.5;
          if (scene.fog?.color?.setHex) scene.fog.color.setHex(0x1e1b4b);
          tintTerrain(0x334155, 0x475569);
          let ptIdx = 0;
          for (const item of this._baseLights) {
            if (item.isDir) {
              item.light.color.setHex(0x93a5ff);
              item.light.intensity = 2.65;
            } else if (item.isHemi) {
              item.light.color.setHex(0xc4b5fd);
              if (item.light.groundColor) item.light.groundColor.setHex(0x1e293b);
              item.light.intensity = 1.32;
            } else if (item.isPoint) {
              item.light.color.setHex(ptIdx % 2 === 0 ? 0x38bdf8 : 0xf472b6);
              item.light.intensity = Math.max(18, item.intensity * 1.3);
              ptIdx++;
            }
          }
        } else if (this.atmosphere === "snow") {
          setSolidBg(0xcbd5e1);
          if ("backgroundIntensity" in scene) scene.backgroundIntensity = 1.05;
          if ("environmentIntensity" in scene) scene.environmentIntensity = 0.95;
          if (scene.fog?.color?.setHex) scene.fog.color.setHex(0xe2e8f0);
          tintTerrain(0xf1f5f9, 0xe2e8f0);
          let ptIdx = 0;
          for (const item of this._baseLights) {
            if (item.isDir) {
              item.light.color.setHex(0xf8fafc);
              item.light.intensity = 3.1;
            } else if (item.isHemi) {
              item.light.color.setHex(0xe0f2fe);
              if (item.light.groundColor) item.light.groundColor.setHex(0x94a3b8);
              item.light.intensity = 1.35;
            } else if (item.isPoint) {
              item.light.color.setHex(ptIdx % 2 === 0 ? 0x7dd3fc : 0xe0f2fe);
              item.light.intensity = Math.max(18, item.intensity * 1.2);
              ptIdx++;
            }
          }
        } else if (this.atmosphere === "rain") {
          setSolidBg(0x1e293b);
          if ("backgroundIntensity" in scene) scene.backgroundIntensity = 0.72;
          if ("environmentIntensity" in scene) scene.environmentIntensity = 0.55;
          if (scene.fog?.color?.setHex) scene.fog.color.setHex(0x334155);
          tintTerrain(0x475569, 0x334155);
          let ptIdx = 0;
          for (const item of this._baseLights) {
            if (item.isDir) {
              item.light.color.setHex(0x7dd3fc);
              item.light.intensity = 1.95;
            } else if (item.isHemi) {
              item.light.color.setHex(0x64748b);
              if (item.light.groundColor) item.light.groundColor.setHex(0x0f172a);
              item.light.intensity = 1.1;
            } else if (item.isPoint) {
              item.light.color.setHex(ptIdx % 2 === 0 ? 0x38bdf8 : 0x818cf8);
              item.light.intensity = Math.max(19, item.intensity * 1.35);
              ptIdx++;
            }
          }
        } else {
          if (this._baseBg) scene.background = this._baseBg;
          if ("backgroundIntensity" in scene) scene.backgroundIntensity = this._baseBgInt;
          if ("environmentIntensity" in scene) scene.environmentIntensity = this._baseEnvInt;
          if (this._baseFogHex !== null && scene.fog?.color?.setHex) scene.fog.color.setHex(this._baseFogHex);
          for (const t of this._baseTerrain) {
            t.mat.color.setHex(t.hex);
          }
          for (const item of this._baseLights) {
            item.light.color.setHex(item.hex);
            item.light.intensity = item.intensity;
            if (item.groundHex !== null && item.light.groundColor) item.light.groundColor.setHex(item.groundHex);
          }
        }
      } catch (_) {}
    }
  };
  window.__halayDirector = StageDirector;

  // --- Interactive VS Arena (Countries / Cities / Bride vs Groom Tug-of-War) ---
  const VsArena = {
    directorMode: "auto",
    countryScores: { tr: 12, world: 6 },
    countryWarTop: [],
    teamScores: { gelin: 10, damat: 10 },
    cityTop: [],
    subModeIdx: 0,
    leftEl: null,
    midEl: null,
    rightEl: null,
    fillEl: null,

    bind(root) {
      if (!root) return;
      this.leftEl = root.querySelector("#ch-vs-left");
      this.midEl = root.querySelector("#ch-vs-mid");
      this.rightEl = root.querySelector("#ch-vs-right");
      this.fillEl = root.querySelector("#ch-vs-fill");
      this.render();
    },

    ingest(msg) {
      if (!msg || typeof msg !== "object") return;
      let dirty = false;
      if (msg.country_scores && typeof msg.country_scores === "object") {
        this.countryScores = {
          tr: Math.max(1, Number(msg.country_scores.tr || 0)),
          world: Math.max(1, Number(msg.country_scores.world || 0))
        };
        dirty = true;
      }
      if (Array.isArray(msg.country_war_top) && msg.country_war_top.length) {
        this.countryWarTop = msg.country_war_top;
        dirty = true;
      }
      if (msg.team_scores && typeof msg.team_scores === "object") {
        this.teamScores = {
          gelin: Math.max(1, Number(msg.team_scores.gelin || 0)),
          damat: Math.max(1, Number(msg.team_scores.damat || 0))
        };
        dirty = true;
      }
      if (Array.isArray(msg.city_leaderboard) && msg.city_leaderboard.length) {
        this.cityTop = msg.city_leaderboard;
        dirty = true;
      }
      if (dirty) this.render();
    },

    rotateAuto() {
      this.subModeIdx = (this.subModeIdx + 1) % 3;
      this.render();
    },

    render() {
      if (!this.leftEl || !this.rightEl || !this.fillEl) return;
      const p = HudLangEngine.pack();
      let mode = this.directorMode;
      if (mode === "auto") {
        const hasCities = this.cityTop.length >= 2;
        const modes = hasCities ? ["world", "city", "wedding"] : ["world", "wedding"];
        mode = modes[this.subModeIdx % modes.length];
      }
      let lTxt = p.vsWorldL, rTxt = p.vsWorldR, lVal = 1, rVal = 1, mid = "⚡ VS ⚡", isWorld = false;
      if (mode === "city") {
        if (this.cityTop.length >= 2) {
          const a = this.cityTop[0], b = this.cityTop[1];
          lTxt = `🏙️ ${a.plate} ${sliceCodePoints(a.city, 10)}`;
          rTxt = `${sliceCodePoints(b.city, 10)} ${b.plate} 🏛️`;
          lVal = Math.max(1, Number(a.score || 1));
          rVal = Math.max(1, Number(b.score || 1));
        } else {
          lTxt = p.vsCityFbL; rTxt = p.vsCityFbR; lVal = 54; rVal = 46;
        }
        mid = "🏙️ VS";
      } else if (mode === "wedding") {
        lTxt = p.vsBride; rTxt = p.vsGroom;
        lVal = Math.max(1, Number(this.teamScores.gelin || 1));
        rVal = Math.max(1, Number(this.teamScores.damat || 1));
        mid = "💐 VS";
      } else {
        isWorld = true;
        if (this.countryWarTop.length >= 2) {
          const c1 = this.countryWarTop[0], c2 = this.countryWarTop[1];
          lTxt = String(c1.code || c1.lang || "tr").toUpperCase();
          rTxt = String(c2.code || c2.lang || "en").toUpperCase();
          lVal = Math.max(1, Number(c1.score || 1));
          rVal = Math.max(1, Number(c2.score || 1));
        } else {
          lTxt = p.vsWorldL; rTxt = p.vsWorldR;
          lVal = Math.max(1, Number(this.countryScores.tr || 12));
          rVal = Math.max(1, Number(this.countryScores.world || 6));
        }
      }
      const tot = Math.max(1, lVal + rVal);
      const pct = Math.max(14, Math.min(86, Math.round((lVal / tot) * 100)));
      if (isWorld) {
        const fCode = this.countryWarTop.length >= 2 ? String(this.countryWarTop[0].code || this.countryWarTop[0].lang || "tr") : (HudLangEngine.current === "az" ? "az" : "tr");
        this.leftEl.innerHTML = `${flagSvg(fCode)} <span>${escHtml(lTxt)} ${pct}%</span>`;
      } else {
        this.leftEl.textContent = `${lTxt} ${pct}%`;
      }
      this.rightEl.textContent = `${100 - pct}% ${rTxt}`;
      if (this.midEl) this.midEl.textContent = mid;
      this.fillEl.style.width = `${pct}%`;
    }
  };

  function syncBelowHudPositions() {
    const hud = document.getElementById("halay-cinema-hud");
    const stage = document.getElementById("halay-stage");
    const dj = document.getElementById("halay-dj-subtitle");
    if (!hud) return;
    const scheduleResync = () => {
      if (!window.__halaySyncRaf) {
        window.__halaySyncRaf = requestAnimationFrame(() => {
          window.__halaySyncRaf = 0;
          syncBelowHudPositions();
        });
      }
    };
    if (!hud.__halayObserved) {
      hud.__halayObserved = true;
      if (typeof ResizeObserver !== "undefined") {
        new ResizeObserver(scheduleResync).observe(hud);
      }
    }
    if (stage && !stage.__halayObserved) {
      stage.__halayObserved = true;
      if (typeof ResizeObserver !== "undefined") {
        new ResizeObserver(scheduleResync).observe(stage);
      }
      if (typeof MutationObserver !== "undefined") {
        new MutationObserver(scheduleResync).observe(stage, { childList: true });
      }
    }
    const hudBottom = hud.getBoundingClientRect().bottom;
    if (!(hudBottom > 0)) return;
    let nextTop = Math.round(hudBottom + 5);
    if (stage) {
      stage.style.top = `${nextTop}px`;
      if (stage.children.length > 0 && stage.querySelector(".sc-card")) {
        const stRect = stage.getBoundingClientRect();
        if (stRect.height > 4) nextTop = Math.round(stRect.bottom + 5);
      }
    }
    if (dj) {
      dj.style.top = `${nextTop}px`;
    }
  }
  window.__syncBelowHudPositions = syncBelowHudPositions;
  window.addEventListener("resize", () => syncBelowHudPositions(), { passive: true });

  // --- Cinematic Multilingual DJ Film Subtitle Bar ---
  const DjSubtitleBar = {
    el: null,
    metaEl: null,
    lineEl: null,
    _hideTimer: null,

    init() {
      if (document.getElementById("halay-dj-subtitle")) return;
      const box = document.createElement("div");
      box.id = "halay-dj-subtitle";
      box.setAttribute("role", "status");
      box.innerHTML = `<div class="djs-meta" id="djs-meta">🎧 MEYDAN DJ</div><div class="djs-line" id="djs-line" dir="auto"></div>`;
      (document.body || document.documentElement).appendChild(box);
      this.el = box;
      this.metaEl = box.querySelector("#djs-meta");
      this.lineEl = box.querySelector("#djs-line");
      syncBelowHudPositions();
    },

    show(msg) {
      if (!this.el) this.init();
      const text = String(msg?.text || "").trim();
      if (!text) return;
      const p = HudLangEngine.pack(msg?.lang || HudLangEngine.current);
      const fSvg = flagSvg(msg?.lang || msg?.flag || HudLangEngine.current);
      if (msg?.kind === "periodic") {
        this.metaEl.innerHTML = `<span>${escHtml(p.djMeta)} •</span> ${fSvg} <span>${escHtml(msg.lang_label || p.code)}</span>`;
      } else {
        const safeNick = escHtml(sliceCodePoints(msg?.user?.nickname || p.guestFb, 16));
        this.metaEl.innerHTML = `${fSvg} <span>@${safeNick} ▸ ${escHtml(p.djMeta)}</span>`;
      }
      this.lineEl.textContent = text;
      syncBelowHudPositions();
      this.el.classList.add("is-open");
      clearTimeout(this._hideTimer);
      this._hideTimer = setTimeout(() => {
        if (!AiHostVoicePlayer._playing) this.hide();
      }, msg?.tts_url ? 9500 : 5400);
    },

    onVoiceStop() {
      clearTimeout(this._hideTimer);
      this._hideTimer = setTimeout(() => this.hide(), 750);
    },

    hide() {
      this.el?.classList.remove("is-open");
    }
  };
  window.__halayDjSubtitle = DjSubtitleBar;

  const GiftLadderBar = {
    el: null,
    _lastLang: "",
    _costs: ["1💎", "20💎", "30💎", "50💎", "90💎", "100💎", "99💎", "199💎"],
    _labels: {
      tr: ["HALAY", "DAVUL", "KRAL", "ZURNA", "ŞÖLEN", "GELİN", "DAMAT", "PARA"],
      en: ["JOIN", "DRUM", "KING", "ZURNA", "PARTY", "BRIDE", "GROOM", "CASH"],
      de: ["TANZ", "TROMML", "KÖNIG", "ZURNA", "PARTY", "BRAUT", "BRÄUT", "GELD"],
      fr: ["DANSE", "TAMB", "CHEF", "ZURNA", "FÊTE", "MARIÉE", "MARIÉ", "PLUIE"],
      ru: ["ХАЛАЙ", "БУБЕН", "ЛИДЕР", "ЗУРНА", "САЛЮТ", "НЕВЕСТ", "ЖЕНИХ", "ДЕНЬГИ"],
      es: ["ÚNETE", "TAMBOR", "LÍDER", "ZURNA", "FIESTA", "NOVIA", "NOVIO", "DINERO"],
      ar: ["انضم", "طبال", "القائد", "زورنا", "احتفال", "العروس", "العريس", "أموال"],
      az: ["HALAY", "DAVUL", "LİDER", "ZURNA", "ŞÖLEN", "GƏLİN", "BƏY", "PUL"]
    },
    init() {
      if (document.getElementById("halay-gift-ladder")) return;
      const bar = document.createElement("div");
      bar.id = "halay-gift-ladder";
      const host = document.getElementById("halay-cinema-hud") || document.body || document.documentElement;
      host.appendChild(bar);
      this.el = bar;
      this.render();
      setInterval(() => this.render(), 2500);
    },
    render() {
      if (!this.el) return;
      const host = document.getElementById("halay-cinema-hud");
      if (host && this.el.parentElement !== host) host.appendChild(this.el);
      const lang = HudLangEngine.current || "tr";
      if (lang === this._lastLang) return;
      this._lastLang = lang;
      const t = this._labels[lang] || this._labels.en;
      this.el.innerHTML =
        `<img class="gl-icons-img" src="/assets/ui/gift_icons_only.png" alt="Gifts" />` +
        `<div class="gl-costs">` +
        this._costs.map((c) => `<span class="gl-cost">${escHtml(c)}</span>`).join("") +
        `</div>` +
        `<div class="gl-tr-labels" dir="${lang === "ar" ? "rtl" : "ltr"}">` +
        t.map((lbl) => `<span class="gl-tr-lbl">${escHtml(lbl)}</span>`).join("") +
        `</div>`;
    }
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => GiftLadderBar.init(), { once: true });
  } else {
    GiftLadderBar.init();
  }

  // --- Unified Interactive Cinema HUD Controller (Preserves __halayTopDock API for zero regressions) ---
  const TopDock = {
    el: null,
    titleWrapEl: null,
    langPillEl: null,
    titleEl: null,
    audioPillEl: null,
    audioTxtEl: null,
    goalPillEl: null,
    muteBtn: null,
    pillHitTimers: {},
    _morphTimer: null,
    roomLikes: 0,
    topLeaderName: "",
    bestStreakText: "",
    roundNumber: 1,
    roundRemSec: 900,
    happyHour2x: false,
    finalClutch3x: false,
    dominantCountry: "tr",
    partyPct: 0,
    partyPatron: "",
    partyActive: false,
    reigningChampions: [],
    throneMin: 30,
    brideMin: 199,
    groomMin: 199,
    _spotIdx: 0,
    _spotLangIdx: 0,
    seatCount: 0,
    maxSeats: 24,
    queueCount: 0,
    queueNext: null,
    roundPillEl: null,
    partyFillEl: null,
    partyTxtEl: null,
    showcaseEl: null,
    roleHolders: { halaybasi: "", gelin: "", damat: "", davulcu: "", zurnaci: "" },

    setRoundState(msg) {
      if (!msg || typeof msg !== "object") return;
      if (msg.round_number) this.roundNumber = Math.max(1, Number(msg.round_number));
      if (typeof msg.round_rem_sec === "number") this.roundRemSec = Math.max(0, Number(msg.round_rem_sec));
      if (typeof msg.happy_hour_2x === "boolean") this.happyHour2x = msg.happy_hour_2x;
      if (typeof msg.final_clutch_3x === "boolean") this.finalClutch3x = msg.final_clutch_3x;
      if (msg.dominant_country) this.dominantCountry = String(msg.dominant_country);
      if (typeof msg.party_pct === "number") this.partyPct = Math.max(0, Math.min(100, Number(msg.party_pct)));
      if (msg.party_patron !== undefined) this.partyPatron = msg.party_patron?.nickname ? String(msg.party_patron.nickname) : "";
      if (typeof msg.party_active === "boolean") this.partyActive = msg.party_active;
      if (Array.isArray(msg.reigning_champions)) this.reigningChampions = msg.reigning_champions.map(String);
      if (msg.throne_min) this.throneMin = Math.max(30, Number(msg.throne_min));
      if (msg.bride_min) this.brideMin = Math.max(199, Number(msg.bride_min));
      if (msg.groom_min) this.groomMin = Math.max(199, Number(msg.groom_min));
      if (typeof msg.max_seats === "number" && msg.max_seats > 0) this.maxSeats = Math.max(1, Number(msg.max_seats));
      if (typeof msg.seat_count === "number") this.seatCount = Math.max(0, Number(msg.seat_count));
      if (typeof msg.queue_count === "number") this.queueCount = Math.max(0, Number(msg.queue_count));
      if (msg.queue_next !== undefined) this.queueNext = msg.queue_next || null;
      if (Array.isArray(msg.stage_order)) applyStageOrder(msg.stage_order);
      this.renderRoundPill();
      this.renderPartyBar();
      this.renderShowcase();
      this.refreshDancerCount();
      MvpBoard?.renderNow?.();
    },

    renderPartyBar() {
      if (!this.partyFillEl || !this.partyTxtEl) return;
      const pct = Math.max(0, Math.min(100, Number(this.partyPct || 0)));
      this.partyFillEl.style.width = `${this.partyActive ? 100 : pct}%`;
      const pTxt = this.partyPatron ? `@${sliceCodePoints(this.partyPatron, 14)}` : "—";
      this.partyTxtEl.textContent = this.partyActive
        ? `🎉 MEGA ŞÖLEN AKTİF • Patron: ${pTxt}`
        : `🔥 Şölen %${pct} • Patron: ${pTxt}`;
    },

    renderRoundPill() {
      if (!this.roundPillEl) return;
      const p = HudLangEngine.pack(HudLangEngine.current);
      const mm = String(Math.floor(this.roundRemSec / 60)).padStart(2, "0");
      const ss = String(this.roundRemSec % 60).padStart(2, "0");
      const rTxt = (p.roundTag || "{n}. DÜĞÜN").replace("{n}", String(this.roundNumber));
      this.roundPillEl.classList.toggle("is-2x", Boolean(this.finalClutch3x || this.happyHour2x));
      this.roundPillEl.textContent = this.finalClutch3x
        ? `🔥 FINAL 3X • ${mm}:${ss}`
        : (this.happyHour2x ? `🔥 2X • ${mm}:${ss}` : `${rTxt} • ${mm}:${ss}`);
    },

    renderShowcase() {
      if (!this.showcaseEl) return;
      const p = HudLangEngine.pack(HudLangEngine.current);
      const rows = Array.isArray(p.menu) ? p.menu : HUD_I18N.tr.menu;
      const cards = this.showcaseEl.querySelectorAll(".ch-sc-card");
      const startIdx = ((this._scPage || 0) % 2) * 3;
      const repTokens = (raw) => String(raw || "")
        .replace("{m}", String(this.throneMin || 30))
        .replace("{b}", String(this.brideMin || 199))
        .replace("{g}", String(this.groomMin || 199));
      rows.forEach((pair, idx) => {
        const card = cards[idx];
        if (!card) return;
        card.classList.toggle("is-hidden-slot", idx < startIdx || idx >= startIdx + 3);
        const iEl = card.querySelector(".ch-sc-item");
        const rEl = card.querySelector(".ch-sc-role");
        if (iEl) iEl.textContent = repTokens(pair[0]);
        if (rEl) rEl.textContent = repTokens(pair[1]);
      });
    },

    setRoleHolder(role, nick) {
      if (!role || !(role in this.roleHolders)) return;
      const clean = sliceCodePoints(String(nick || "").trim(), 12);
      if (!clean) return;
      this.roleHolders[role] = clean;
      if (role === "halaybasi") this.topLeaderName = clean;
      MvpBoard?.scheduleRender?.(false);
    },

    getActiveDancerCount() {
      const liveLen = Number(window.halay?.line?.dancers?.length || 0);
      return Math.max(liveLen, joinedUsers.size || 0);
    },

    init() {
      ["halay-hud-board", "halay-compliance-shield", "halay-top-dock", "halay-mvp-board", "halay-fx-strip"].forEach((id) => {
        document.getElementById(id)?.remove();
      });
      if (document.getElementById("halay-cinema-hud")) return;

      const dock = document.createElement("div");
      dock.id = "halay-cinema-hud";
      if (localStorage.getItem("divalar:dock_collapsed") === "1") dock.classList.add("is-collapsed");
      dock.innerHTML = `
        <div class="ch-top">
          <div class="ch-title-wrap" id="ch-title-wrap">
            <span class="htd-dot"></span>
            <span class="ch-lang-pill" id="ch-lang-pill">${flagSvg("tr")} <span>TR</span></span>
            <span class="ch-title" id="ch-title">KIR DÜĞÜNÜ MEYDANI</span>
            <span class="ch-round-pill" id="ch-round-pill">1. DÜĞÜN • 15:00</span>
          </div>
          <div class="htd-right">
            <span class="ch-audio-pill" id="ch-audio-pill" dir="ltr">
              <span class="ch-eq" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
              <span id="ch-audio-txt" dir="ltr">🎵 Halay Mix</span>
            </span>
            <span class="htd-goal-pill" id="htd-goal-pill">🕺 0 Halaycı</span>
            <button type="button" class="htd-ibtn" id="htd-mute-btn" title="Ses">${AlertSfx.muted ? "🔇" : "🔊"}</button>
            <button type="button" class="htd-ibtn" id="htd-fold-btn" title="Küçült/Büyüt">${dock.classList.contains("is-collapsed") ? "▾" : "▴"}</button>
          </div>
        </div>
        <div class="ch-podium" id="ch-podium"></div>
        <div class="ch-guide" id="ch-guide">
          <div class="ch-pill" data-pill="join"><span class="ch-pill-key">💬</span><span class="ch-pill-lbl" id="ch-pl-join">KATIL➔Gir</span></div>
          <div class="ch-pill" data-pill="girl"><span class="ch-pill-key">"1"👗</span><span class="ch-pill-lbl" id="ch-pl-girl">Kız Stil</span></div>
          <div class="ch-pill" data-pill="boy"><span class="ch-pill-key">"2"🕺</span><span class="ch-pill-lbl" id="ch-pl-boy">Efe Stil</span></div>
          <div class="ch-pill" data-pill="city"><span class="ch-pill-key">"34"🏙️</span><span class="ch-pill-lbl" id="ch-pl-city">Şehir Yaz</span></div>
          <div class="ch-pill" data-pill="dj"><span class="ch-pill-key" id="ch-pl-dj-key">"!istek"🎧</span><span class="ch-pill-lbl" id="ch-pl-dj">Şarkı Seç</span></div>
        </div>
        <div class="ch-vs">
          <div class="ch-vs-labels">
            <span class="ch-vs-side" id="ch-vs-left">${flagSvg("tr")} <span>TR 50%</span></span>
            <span class="ch-vs-mid" id="ch-vs-mid">⚡ VS ⚡</span>
            <span class="ch-vs-side" id="ch-vs-right">50% DÜNYA 🌍</span>
          </div>
          <div class="ch-vs-track"><div class="ch-vs-fill" id="ch-vs-fill"></div></div>
        </div>
        <div class="ch-party-bar" id="ch-party-bar">
          <div class="ch-party-fill" id="ch-party-fill"></div>
          <span class="ch-party-txt" id="ch-party-txt">🔥 Şölen %0 • Patron: —</span>
        </div>
      `;
      (document.body || document.documentElement).appendChild(dock);

      this.el = dock;
      this.titleWrapEl = dock.querySelector("#ch-title-wrap");
      this.langPillEl = dock.querySelector("#ch-lang-pill");
      this.titleEl = dock.querySelector("#ch-title");
      this.roundPillEl = dock.querySelector("#ch-round-pill");
      this.partyFillEl = dock.querySelector("#ch-party-fill");
      this.partyTxtEl = dock.querySelector("#ch-party-txt");
      this.showcaseEl = dock.querySelector("#ch-showcase");
      this.audioPillEl = dock.querySelector("#ch-audio-pill");
      this.audioTxtEl = dock.querySelector("#ch-audio-txt");
      this.goalPillEl = dock.querySelector("#htd-goal-pill");
      this.muteBtn = dock.querySelector("#htd-mute-btn");

      this.muteBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const m = AlertSfx.toggleMute();
        this.muteBtn.textContent = m ? "🔇" : "🔊";
      });
      const foldBtn = dock.querySelector("#htd-fold-btn");
      foldBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const c = dock.classList.toggle("is-collapsed");
        foldBtn.textContent = c ? "▾" : "▴";
        try { localStorage.setItem("divalar:dock_collapsed", c ? "1" : "0"); } catch (_) {}
        requestAnimationFrame(() => syncBelowHudPositions());
      });
      if (typeof ResizeObserver === "function") {
        try {
          new ResizeObserver(() => syncBelowHudPositions()).observe(dock);
        } catch (_) {}
      }
      requestAnimationFrame(() => syncBelowHudPositions());

      VsArena.bind(dock);
      this.applyLanguage(HudLangEngine.current, true);
      this.refreshDancerCount();
      this.updateAudioBadge();
      this.renderRoundPill();

      setInterval(() => {
        HudLangEngine.tickRotate();
        this.refreshDancerCount();
        if (this.roundRemSec > 0) {
          this.roundRemSec -= 1;
          this.happyHour2x = this.roundRemSec <= 120;
          this.renderRoundPill();
        }
      }, 1000);
      this._scPage = 0;
      setInterval(() => {
        this._scPage = ((this._scPage || 0) + 1) % 2;
        this.renderShowcase();
      }, 9000);
      setInterval(() => VsArena.rotateAuto(), 11000);
      setInterval(() => this.showPeriodicDjGuide(false), 24000);
      window.__halayShowDjGuide = () => this.showPeriodicDjGuide(true);
    },

    showPeriodicDjGuide(force = false) {
      if (!force && (AiHostVoicePlayer._playing || document.hidden)) return;
      const repTokens = (raw) => String(raw || "")
        .replace("{m}", String(this.throneMin || 30))
        .replace("{b}", String(this.brideMin || 199))
        .replace("{g}", String(this.groomMin || 199));
      if (force) {
        const p = HudLangEngine.pack(HudLangEngine.current);
        this.flashActionPill("dj");
        DjSubtitleBar?.show?.({
          kind: "periodic",
          lang: HudLangEngine.current,
          flag: p.flag,
          lang_label: p.code,
          text: repTokens(p.djCallout || '🎧 Canlı DJ Kabini: !istek <Şarkı> • 🇷🇺 !трек • 🇬🇧 !song'),
        });
        return;
      }
      const rotLangs = ["tr", "ru", "en", "ar", "es", "de", "fr", "az"];
      const sIdx = (this._spotIdx || 0) % 6;
      const lCode = rotLangs[(this._spotLangIdx || 0) % rotLangs.length];
      this._spotIdx = (sIdx + 1) % 6;
      this._spotLangIdx = ((this._spotLangIdx || 0) + 1) % rotLangs.length;
      const p = HudLangEngine.pack(lCode);
      const list = Array.isArray(p.spotlights) && p.spotlights.length ? p.spotlights : HUD_I18N.tr.spotlights;
      const pick = list[sIdx % list.length] || { pill: "dj", text: p.djCallout };
      let finalText = repTokens(pick.text || p.djCallout);
      if (sIdx === 0 && this.queueCount > 0 && this.queueNext?.nickname && p.queueNextHint) {
        finalText = String(p.queueNextHint)
          .replace("{nick}", sliceCodePoints(String(this.queueNext.nickname), 14))
          .replace("{q}", String(this.queueCount));
      }
      if (pick.pill === "bride_groom") {
        if (MvpBoard?.podiumSlots?.[0]?.card) MvpBoard._pulseCard(MvpBoard.podiumSlots[0].card);
        if (MvpBoard?.podiumSlots?.[2]?.card) MvpBoard._pulseCard(MvpBoard.podiumSlots[2].card);
      } else if (pick.pill) {
        this.flashActionPill(pick.pill);
      }
      DjSubtitleBar?.show?.({
        kind: "periodic",
        lang: p.code ? lCode : HudLangEngine.current,
        flag: p.flag,
        lang_label: p.code,
        text: finalText,
      });
    },

    applyLanguage(lang, immediate = false) {
      if (!this.el) return;
      const activeLang = HudLangEngine.current || lang;
      const p = HudLangEngine.pack(activeLang);
      if (this.langPillEl) this.langPillEl.innerHTML = `${flagSvg(activeLang)} <span>${escHtml(p.code)}</span>`;
      if (this.titleEl) {
        this.titleEl.textContent = p.stageTitle;
        this.titleEl.dir = activeLang === "ar" ? "rtl" : "ltr";
      }
      const gJoin = this.el.querySelector("#ch-pl-join");
      const g1 = this.el.querySelector("#ch-pl-girl");
      const g2 = this.el.querySelector("#ch-pl-boy");
      const g3 = this.el.querySelector("#ch-pl-city");
      const gDjKey = this.el.querySelector("#ch-pl-dj-key");
      const gDj = this.el.querySelector("#ch-pl-dj");
      if (gJoin && !this.pillHitTimers.join) gJoin.textContent = p.pJoin || "KATIL➔Gir";
      if (g1 && !this.pillHitTimers.girl) g1.textContent = p.p1;
      if (g2 && !this.pillHitTimers.boy) g2.textContent = p.p2;
      if (g3 && !this.pillHitTimers.city) g3.textContent = p.pCity;
      if (gDjKey) gDjKey.textContent = `${p.djKey || '"!istek"'}🎧`;
      if (gDj && !this.pillHitTimers.dj) gDj.textContent = p.pDj || "Şarkı Seç";
      this.renderRoundPill();
      this.renderShowcase();
      this.refreshDancerCount();
      MvpBoard?.applyLanguageLabels?.(activeLang);
      VsArena.render();
      if (!immediate && this.titleWrapEl) {
        this.titleWrapEl.classList.remove("is-morph");
        void this.titleWrapEl.offsetWidth;
        this.titleWrapEl.classList.add("is-morph");
      } else {
        this.titleWrapEl?.classList.remove("is-morph");
      }
    },

    flashActionPill(kind, nick) {
      if (!this.el || !kind) return;
      const pill = this.el.querySelector(`.ch-pill[data-pill="${kind}"]`);
      const lbl = pill?.querySelector(".ch-pill-lbl");
      if (!pill || !lbl) return;
      pill.classList.remove("is-hit");
      void pill.offsetWidth;
      pill.classList.add("is-hit");
      if (nick) lbl.textContent = `✨ ${sliceCodePoints(nick, 9)}`;
      clearTimeout(this.pillHitTimers[kind]);
      this.pillHitTimers[kind] = setTimeout(() => {
        delete this.pillHitTimers[kind];
        pill.classList.remove("is-hit");
        const p = HudLangEngine.pack();
        const map = { join: p.pJoin || "KATIL➔Gir", girl: p.p1, boy: p.p2, city: p.pCity, dj: p.pDj || "Şarkı Seç" };
        lbl.textContent = map[kind] || p.p1;
      }, 2400);
    },

    updateAudioBadge() {
      if (!this.audioPillEl || !this.audioTxtEl) return;
      const isDj = Boolean(AiHostVoicePlayer._playing);
      this.audioPillEl.classList.toggle("is-dj", isDj);
      if (isDj) {
        this.audioTxtEl.textContent = `🎧 DJ • ${AiHostVoicePlayer._activeLang || HudLangEngine.pack().code}`;
      } else {
        const t = HalayJukeboxAudio.currentTitle || "Halay Mix";
        const reqBy = HalayJukeboxAudio.currentRequestedBy || "";
        if (reqBy) {
          this.audioTxtEl.textContent = `🎧 @${sliceCodePoints(reqBy, 9)} • ${sliceCodePoints(t, 12)}`;
        } else {
          this.audioTxtEl.textContent = `🎵 ${sliceCodePoints(t, 16)}`;
        }
      }
    },

    refreshDancerCount() {
      const cnt = this.seatCount > 0 ? this.seatCount : this.getActiveDancerCount();
      const maxS = Math.max(1, this.maxSeats || 24);
      const qCnt = Math.max(0, this.queueCount || 0);
      if (this.goalPillEl) {
        this.goalPillEl.textContent = qCnt > 0
          ? `🪑 ${cnt}/${maxS} • ⏳ ${qCnt}`
          : `🪑 ${cnt}/${maxS}`;
      }
    },

    renderDeck() {
      this.refreshDancerCount();
    },

    reset() {
      this.roomLikes = 0;
      this.topLeaderName = "";
      this.bestStreakText = "";
      this.roleHolders = { halaybasi: "", gelin: "", damat: "", davulcu: "", zurnaci: "" };
      this.refreshDancerCount();
      VsArena.render();
    },

    updateRoomLikes(totalLikes) {
      this.roomLikes = Math.max(this.roomLikes, Number(totalLikes || 0));
      this.refreshDancerCount();
      MvpBoard.updateRoomLikes(this.roomLikes);
    }
  };

  // --- Avatar Canvas Renderer & Single-Slot Priority Mutex Alert Stage (P0..P3) ---
  function drawAvatarToCanvas(canvas, user) {
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    drawInitials(ctx, canvas, user);
    const avUrl = user?.avatar_url
      || (typeof user?.avatar === "string" ? user.avatar : null)
      || (typeof user?.avatar?.small === "string" ? user.avatar.small : null);
    if (avUrl) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        try {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.save();
          ctx.beginPath();
          ctx.arc(canvas.width / 2, canvas.height / 2, canvas.width / 2, 0, Math.PI * 2);
          ctx.clip();
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          ctx.restore();
          const cw = canvas.width || 72;
          const ch = canvas.height || 72;
          const buf = ctx.getImageData(0, 0, cw, ch).data;
          const pts = [Math.floor(cw * 0.25), Math.floor(cw * 0.5), Math.floor(cw * 0.75)];
          let nearWhite = 0;
          for (let yi = 0; yi < 3; yi++) {
            const rowOff = pts[yi] * cw;
            for (let xi = 0; xi < 3; xi++) {
              const idx = (rowOff + pts[xi]) * 4;
              const r = buf[idx], g = buf[idx + 1], b = buf[idx + 2], a = buf[idx + 3];
              const mn = r < g ? (r < b ? r : b) : (g < b ? g : b);
              const mx = r > g ? (r > b ? r : b) : (g > b ? g : b);
              if (a < 25 || (mn >= 235 && mx - mn <= 12)) nearWhite++;
            }
          }
          if (nearWhite >= 7) drawInitials(ctx, canvas, user);
        } catch (_) {
          drawInitials(ctx, canvas, user);
        }
      };
      img.onerror = () => drawInitials(ctx, canvas, user);
      img.src = avUrl;
    }
  }

  function drawEmptyPodBadge(ctx, canvas, icon, isThrone) {
    if (!ctx || !canvas) return;
    const w = canvas.width || 72;
    const h = canvas.height || 72;
    const cx = w / 2;
    const cy = h / 2;
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    const grad = ctx.createRadialGradient(cx, cy * 0.85, w * 0.08, cx, cy, w * 0.5);
    grad.addColorStop(0, isThrone ? "rgba(250, 204, 21, 0.34)" : "rgba(148, 163, 184, 0.26)");
    grad.addColorStop(1, "rgba(15, 23, 42, 0.92)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, w * 0.49, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = isThrone ? "rgba(253, 224, 71, 0.88)" : "rgba(148, 163, 184, 0.55)";
    ctx.lineWidth = Math.max(2, w * 0.045);
    ctx.stroke();
    ctx.font = `${Math.round(w * 0.44)}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(icon || "👑", cx, cy + 2);
    ctx.restore();
  }

  function drawInitials(ctx, canvas, user) {
    const name = String(user?.nickname || user?.unique_id || "H").trim();
    const char = (Array.from(name)[0] || "H").toUpperCase();
    const palette = ["#e11d48", "#0284c7", "#7c3aed", "#db2777", "#059669", "#d97706"];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    ctx.save();
    ctx.fillStyle = palette[Math.abs(hash) % palette.length];
    ctx.beginPath();
    ctx.arc(canvas.width / 2, canvas.height / 2, canvas.width / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = `700 ${Math.round(canvas.width * 0.48)}px Inter, Segoe UI, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(char, canvas.width / 2, canvas.height / 2 + 1);
    ctx.restore();
  }

  // --- Competitor-Grade Dual-Column Live Top Rewards + Sender & Top Likers Board (#halay-mvp-board) ---
  const MVP_STORAGE_KEY = "divalar:mvp_v24";
  const MEDALS = ["🥇", "🥈", "🥉"];
  const ROLE_GIFT_FALLBACK = {
    gelin: { id: 5924, name: "Elle Kalp", icon: G_IMG.ekalp },
    damat: { id: 6097, name: "Küçük Taç", icon: G_IMG.ktac },
    zurnaci: { id: 5303, name: "Çay", icon: G_IMG.cay },
    davulcu: { id: 5658, name: "Parfüm", icon: G_IMG.parfum }
  };

  const MvpBoard = {
    el: null,
    podiumSlots: [],
    giftSenders: new Map(),
    giftTotals: new Map(),
    supporterBoard: [],
    vipRoles: {},
    loadedRoomId: "",
    renderTimer: null,
    lastThroneUid: "",

    init() {
      const podRoot = document.getElementById("ch-podium");
      if (!podRoot) return;
      this.el = podRoot;
      podRoot.innerHTML = "";
      this.podiumSlots = [
        this._createPodCard(podRoot, "is-bride", "👰 GELİN", false, "👰"),
        this._createPodCard(podRoot, "r1 is-throne", "👑 HALAYBAŞI", true, "👑"),
        this._createPodCard(podRoot, "is-groom", "🤵 DAMAT", false, "🤵"),
        this._createPodCard(podRoot, "is-star", "⚡ ŞAMPİYON", false, "⚡")
      ];
      this.restoreRoomLedger(sdkState.roomId || "default");
      this.renderNow();
    },

    _createPodCard(parent, cls, topText, isThrone, emptyIcon = "👑") {
      const card = document.createElement("div");
      card.className = `ch-pod-card ${cls}`;
      const top = document.createElement("div");
      top.className = "ch-pod-top";
      top.textContent = topText;
      const avWrap = document.createElement("div");
      avWrap.className = "ch-av-wrap";
      const av = document.createElement("canvas");
      av.className = "ch-av";
      av.width = av.height = isThrone ? 96 : 72;
      const fl = document.createElement("span");
      fl.className = "ch-av-flag";
      avWrap.append(av, fl);
      const nick = document.createElement("div");
      nick.className = "ch-pod-nick";
      nick.textContent = "Meydan";
      const val = document.createElement("div");
      val.className = "ch-pod-val";
      val.textContent = "⭐ —";
      card.append(top, avWrap, nick, val);
      parent.appendChild(card);
      drawEmptyPodBadge(av.getContext("2d", { willReadFrequently: true }), av, emptyIcon, isThrone);
      return { card, top, av, fl, nick, val, uid: "", avUrl: "", flagTxt: "", metricKey: "", isThrone, emptyIcon };
    },

    applyLanguageLabels(lang) {
      if (!this.podiumSlots || this.podiumSlots.length < 4) return;
      const p = HudLangEngine.pack(lang);
      const brideTop = this.podiumSlots[0].top;
      const throneTop = this.podiumSlots[1].top;
      const groomTop = this.podiumSlots[2].top;
      const starTop = this.podiumSlots[3].top;
      if (brideTop) brideTop.textContent = `👰 ${p.brideLbl || "GELİN"}`;
      if (throneTop) throneTop.textContent = `👑 ${p.throne}`;
      if (groomTop) groomTop.textContent = `🤵 ${p.groomLbl || "DAMAT"}`;
      if (starTop) starTop.textContent = `⚡ ${p.star}`;
    },

    formatCount(n) {
      const v = Math.max(0, Number(n || 0));
      if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
      if (v >= 10000) return `${(v / 1000).toFixed(1)}K`;
      if (v >= 1000) return `${(Math.round(v / 100) / 10).toFixed(1)}K`;
      return String(Math.round(v));
    },

    updateRoomLikes() {},

    syncRoomId(roomId) {
      const rid = String(roomId || "").trim();
      if (!rid || rid === this.loadedRoomId) return;
      this.restoreRoomLedger(rid);
      this.scheduleRender(true);
    },

    restoreRoomLedger(roomId) {
      const rid = String(roomId || "").trim() || "default";
      this.loadedRoomId = rid;
      try {
        const raw = JSON.parse(localStorage.getItem(MVP_STORAGE_KEY) || "null");
        if (raw && raw.roomId === rid && Date.now() - Number(raw.updatedAt || 0) < 43200000) {
          this.giftSenders = new Map(Array.isArray(raw.senders) ? raw.senders : []);
          this.giftTotals = new Map(Array.isArray(raw.totals) ? raw.totals : []);
          return;
        }
        if (raw && raw.roomId && raw.roomId !== "default" && rid !== "default" && raw.roomId !== rid) {
          this.giftSenders.clear();
          this.giftTotals.clear();
          localStorage.removeItem(MVP_STORAGE_KEY);
        }
      } catch (_) {}
    },

    persistRoomLedger() {
      const rid = String(sdkState.roomId || this.loadedRoomId || "default");
      try {
        localStorage.setItem(MVP_STORAGE_KEY, JSON.stringify({
          roomId: rid,
          updatedAt: Date.now(),
          senders: [...this.giftSenders.entries()].slice(-60),
          totals: [...this.giftTotals.entries()].slice(-30)
        }));
      } catch (_) {}
    },

    ingestServerData(msg) {
      if (!msg || typeof msg !== "object") return;
      if (msg.room_id) this.syncRoomId(msg.room_id);
      if (msg.roles && typeof msg.roles === "object") {
        this.vipRoles = msg.roles;
        for (const rUser of Object.values(msg.roles)) {
          if (rUser && typeof rUser === "object") buildUser(rUser);
        }
      }
      if (Array.isArray(msg.leaderboard)) {
        this.supporterBoard = msg.leaderboard
          .filter((r) => r && r.uid && Number(r.score || 0) >= 1)
          .map((r) => ({ user: buildUser(r), score: Math.round(Number(r.score || 0)) }));
      }
      if (Array.isArray(msg.gift_leaderboard)) {
        for (const item of msg.gift_leaderboard) {
          if (!item || !item.uid) continue;
          const u = buildUser(item);
          const gid = Number(item.gift_id || 0);
          const gname = String(item.gift_name || "Gül");
          const gkey = String(gid || gname.toLowerCase());
          const pkey = `${u.id}:${gkey}`;
          const icon = proxyAvatar(item.gift_image || resolveKnownGiftIcon(gid, gname));
          const prev = this.giftSenders.get(pkey);
          this.giftSenders.set(pkey, {
            uid: u.id,
            user: u,
            id: gid,
            name: gname,
            icon,
            count: Math.max(prev?.count || 0, Number(item.count || 1)),
            diamonds: Math.max(prev?.diamonds || 0, Number(item.diamonds || 1))
          });
        }
      }
      if (Array.isArray(msg.top_rewards)) {
        for (const t of msg.top_rewards) {
          if (!t) continue;
          const gid = Number(t.gift_id || 0);
          const gname = String(t.gift_name || "Gül");
          const gkey = String(gid || gname.toLowerCase());
          const icon = proxyAvatar(t.gift_image || resolveKnownGiftIcon(gid, gname));
          const prev = this.giftTotals.get(gkey);
          this.giftTotals.set(gkey, {
            id: gid,
            name: gname,
            icon,
            count: Math.max(prev?.count || 0, Number(t.count || 1)),
            diamonds: Math.max(prev?.diamonds || 0, Number(t.diamonds || 1)),
            topNick: cleanDisplayNick(t.top_nickname || prev?.topNick || "", t.top_uid || "İzleyici")
          });
        }
      }
      this.scheduleRender(msg.type === "seed_halay" || msg.type === "status");
    },

    onGift(user, g, persist = true) {
      if (!user || !g) return;
      const uid = String(user.id || user.unique_id || "izleyici");
      const gid = Number(g.id || 0);
      const gname = String(g.name || "Gül");
      const gkey = String(gid || gname.toLowerCase());
      const pkey = `${uid}:${gkey}`;
      const icon = proxyAvatar(g.image_url || resolveKnownGiftIcon(gid, gname));
      const rep = Math.max(1, Number(g.repeat || 1));
      const dia = Math.max(1, Number(g.totalDiamonds || 1));

      const prev = this.giftSenders.get(pkey);
      this.giftSenders.set(pkey, {
        uid,
        user,
        id: gid,
        name: gname,
        icon,
        count: (prev?.count || 0) + rep,
        diamonds: (prev?.diamonds || 0) + dia
      });

      const prevTot = this.giftTotals.get(gkey);
      this.giftTotals.set(gkey, {
        id: gid,
        name: gname,
        icon,
        count: (prevTot?.count || 0) + rep,
        diamonds: (prevTot?.diamonds || 0) + dia,
        topNick: user.nickname
      });

      if (persist) this.persistRoomLedger();
      this.renderNow(pkey);
    },

    onLike() {
      this.scheduleRender(false);
    },

    reset() {
      this.giftSenders.clear();
      this.giftTotals.clear();
      this.supporterBoard = [];
      this.vipRoles = {};
      try { localStorage.removeItem(MVP_STORAGE_KEY); } catch (_) {}
      this.updateRoomLikes(0);
      this.renderNow();
    },

    scheduleRender(immediate = false) {
      if (immediate) {
        clearTimeout(this.renderTimer);
        this.renderTimer = null;
        this.renderNow();
        return;
      }
      if (this.renderTimer) return;
      this.renderTimer = setTimeout(() => {
        this.renderTimer = null;
        this.renderNow();
      }, 220);
    },

    _pulseCard(cardEl) {
      if (!cardEl) return;
      cardEl.classList.remove("is-flash");
      void cardEl.offsetWidth;
      cardEl.classList.add("is-flash");
    },

    _applyPodSlot(slot, data, flashKey, emptyNick = "Meydan", emptyVal = "⭐ —") {
      if (!slot) return;
      slot.card.classList.toggle("is-empty-seat", !data);
      if (!data) {
        if (slot.nick.textContent !== emptyNick) slot.nick.textContent = emptyNick;
        if (slot.metricKey !== `__empty:${emptyVal}`) {
          slot.val.textContent = emptyVal;
          slot.metricKey = `__empty:${emptyVal}`;
        }
        if (slot.flagTxt) {
          slot.flagTxt = "";
          slot.fl.innerHTML = "";
        }
        if (slot.uid !== "__empty") {
          slot.uid = "__empty";
          slot.avUrl = "";
          drawEmptyPodBadge(slot.av.getContext("2d", { willReadFrequently: true }), slot.av, slot.emptyIcon, slot.isThrone);
        }
        return;
      }
      const nick = sliceCodePoints(data.user?.nickname || data.uid || "İzleyici", slot.isThrone ? 12 : 10);
      if (slot.nick.textContent !== nick) slot.nick.textContent = nick;
      const knownRec = HudLangEngine.userLangs.get(String(data.uid || ""));
      const flagKey = data.user?.lang || knownRec?.lang || data.user?.flag || knownRec?.flag || "";
      if (slot.flagTxt !== flagKey) {
        slot.flagTxt = flagKey;
        slot.fl.innerHTML = flagKey ? flagSvg(flagKey) : "";
      }
      const avUrl = data.user?.avatar_url || "";
      if (slot.uid !== data.uid || slot.avUrl !== avUrl) {
        const prevUid = slot.uid;
        slot.uid = data.uid;
        slot.avUrl = avUrl;
        drawAvatarToCanvas(slot.av, data.user);
        if (prevUid && prevUid !== "__empty" && prevUid !== data.uid) this._pulseCard(slot.card);
      }
      if (slot.metricKey !== data.metricKey) {
        slot.metricKey = data.metricKey;
        slot.val.textContent = data.countText;
      }
      if (flashKey && data.key === flashKey) this._pulseCard(slot.card);
    },

    renderNow(flashKey = "") {
      if (!this.el || !this.podiumSlots?.length) return;
      this.applyLanguageLabels(HudLangEngine.current);

      const sortedGifts = [...this.giftSenders.values()].sort((a, b) => (b.diamonds - a.diamonds) || (b.count - a.count));
      const uniqueSenders = [];
      const seenUids = new Set();
      for (const g of sortedGifts) {
        if (!seenUids.has(g.uid)) {
          seenUids.add(g.uid);
          uniqueSenders.push(g);
        }
      }
      const rewardRows = [];
      for (const g of uniqueSenders.slice(0, 3)) {
        const u = viewerProfiles.get(g.uid) || g.user;
        const pkey = `${g.uid}:${g.id || g.name.toLowerCase()}`;
        const pts = Math.max(10, Number(g.diamonds || g.count || 1) * 10);
        rewardRows.push({
          key: pkey,
          uid: g.uid,
          user: u,
          countText: `⭐ ${this.formatCount(pts)}`,
          metricKey: `g:${pts}:${g.count}`
        });
      }
      const usedUids = new Set(rewardRows.map((r) => r.uid));
      if (rewardRows.length < 3 && this.vipRoles) {
        for (const role of ["halaybasi", "gelin", "damat", "davulcu", "zurnaci"]) {
          if (rewardRows.length >= 3) break;
          const rawV = this.vipRoles[role];
          if (!rawV || !rawV.uid) continue;
          const u = buildUser(rawV);
          if (usedUids.has(u.id)) continue;
          usedUids.add(u.id);
          const emo = { halaybasi: "🧣", gelin: "👰", damat: "🤵", davulcu: "🥁", zurnaci: "🎺" }[role] || "⭐";
          rewardRows.push({ key: `vip:${role}`, uid: u.id, user: u, countText: `${emo} VIP`, metricKey: `v:${role}:${u.id}` });
        }
      }
      if (rewardRows.length < 3 && this.supporterBoard.length) {
        for (const s of this.supporterBoard) {
          if (rewardRows.length >= 3) break;
          if (!s.user || usedUids.has(s.user.id)) continue;
          usedUids.add(s.user.id);
          rewardRows.push({ key: `sup:${s.user.id}`, uid: s.user.id, user: s.user, countText: `⭐ ${this.formatCount(s.score)}`, metricKey: `p:${s.score}` });
        }
      }
      const liveDancers = window.halay?.line?.dancers || [];
      if (rewardRows.length < 3 && liveDancers.length) {
        for (const d of liveDancers) {
          if (rewardRows.length >= 3) break;
          const dv = d?.viewer;
          if (!dv?.id || usedUids.has(dv.id)) continue;
          usedUids.add(dv.id);
          const u = viewerProfiles.get(dv.id) || buildUser(dv);
          rewardRows.push({ key: `st:${dv.id}`, uid: u.id, user: u, countText: "💃 LIVE", metricKey: `st:${u.id}` });
        }
      }

      // Podium layout: [0]=Bride (Gelin), [1]=Gold Halaybaşı Throne, [2]=Groom (Damat), [3]=Round Champion / Energy Star
      const p = HudLangEngine.pack(HudLangEngine.current);
      const tMin = TopDock.throneMin || 30;
      const bMin = TopDock.brideMin || 199;
      const gMin = TopDock.groomMin || 199;
      const roleCard = (role, valBadge) => {
        const raw = this.vipRoles?.[role];
        if (!raw || !raw.uid) return null;
        const u = buildUser(raw);
        return { key: `vip:${role}:${u.id}`, uid: u.id, user: u, countText: valBadge, metricKey: `r:${role}:${u.id}:${valBadge}` };
      };
      const brideStr = (p.brideHint || "1× 👑 Taç {b}+").replace("{b}", String(bMin));
      const groomStr = (p.groomHint || "1× 👑 Taç {g}+").replace("{g}", String(gMin));
      const throneStr = (p.throneHint || "1× 🍩 Donut {m}+").replace("{m}", String(tMin));
      const bridePick = roleCard("gelin", brideStr);
      const groomPick = roleCard("damat", groomStr);
      const thronePick = roleCard("halaybasi", throneStr);

      const topEnergy = [...userLikeTotals.entries()]
        .filter(([, cnt]) => cnt > 0)
        .sort((a, b) => b[1] - a[1])
        .map(([uid, cnt]) => {
          const u = viewerProfiles.get(uid) || { id: uid, unique_id: uid, nickname: cleanDisplayNick(uid, uid), avatar_url: null };
          const fmt = `⚡ ${this.formatCount(cnt)}`;
          return { key: `lk:${uid}`, uid, user: u, countText: fmt, metricKey: `l:${fmt}` };
        });
      const starPick = rewardRows[0] || topEnergy[0] || (liveDancers[liveDancers.length - 1]?.viewer ? {
        key: `st:${liveDancers[liveDancers.length - 1].viewer.id}`,
        uid: String(liveDancers[liveDancers.length - 1].viewer.id),
        user: viewerProfiles.get(String(liveDancers[liveDancers.length - 1].viewer.id)) || buildUser(liveDancers[liveDancers.length - 1].viewer),
        countText: "⚡ LIVE",
        metricKey: `stl:${liveDancers[liveDancers.length - 1].viewer.id}`
      } : null);

      this._applyPodSlot(this.podiumSlots[0], bridePick, flashKey, p.emptySeat || "Koltuk Boş", brideStr);
      this._applyPodSlot(this.podiumSlots[1], thronePick, flashKey, p.emptyThrone || "👑 TAHT BOŞ", throneStr);
      this._applyPodSlot(this.podiumSlots[2], groomPick, flashKey, p.emptySeat || "Koltuk Boş", groomStr);
      this._applyPodSlot(this.podiumSlots[3], starPick, "", p.champFb || "Şampiyon", "⭐ —");
    }
  };

  const StageScheduler = {
    el: null,
    queue: [],
    active: null,
    hideTimer: null,
    lastActivityTs: Date.now(),
    seenDedup: new Map(),
    streakTotals: new Map(),
    bestStreakCount: 0,
    ctaEnabled: false,
    entriesSinceCta: 0,
    lastCtaTs: Date.now() - 19000,
    ctaIdx: 0,

    init() {
      if (document.getElementById("halay-stage")) return;
      const stage = document.createElement("div");
      stage.id = "halay-stage";
      stage.setAttribute("role", "status");
      stage.setAttribute("aria-live", "polite");
      (document.body || document.documentElement).appendChild(stage);
      this.el = stage;
    },

    enqueue(item) {
      if (!this.el) this.init();
      const now = Date.now();
      if (item.priority <= 2) this.lastActivityTs = now;

      // Dedup identical non-streak events within 4.2s & bound Map size for marathon streams
      if (item.dedupKey) {
        const prevTs = this.seenDedup.get(item.dedupKey) || 0;
        if (now - prevTs < (item.dedupMs || 4200)) return;
        if (this.seenDedup.size > 400) {
          for (const [k, ts] of this.seenDedup) {
            if (now - ts > 30000) this.seenDedup.delete(k);
          }
        }
        this.seenDedup.set(item.dedupKey, now);
      }

      // 1. In-Place Gift Combo / Streak Upsert (Active OR Queued during fade transition)
      if (item.comboKey) {
        if (this.active && this.active.comboKey === item.comboKey && this.active.cardEl) {
          this.active.comboCount = (this.active.comboCount || 0) + (item.comboCount || 1);
          const cEl = this.active.cardEl.querySelector(".sc-combo");
          if (cEl) {
            cEl.textContent = `x${this.active.comboCount}`;
            cEl.classList.remove("is-pop");
            void cEl.offsetWidth;
            cEl.classList.add("is-pop");
          }
          const subEl = this.active.cardEl.querySelector(".sc-t2");
          if (subEl && item.subText) subEl.textContent = item.subText;
          this._resetActiveTtl(item.ttl || 3500);
          this._trackBestStreak(item.user, item.giftName, this.active.comboCount);
          return;
        }
        const qCombo = this.queue.find((q) => q.comboKey === item.comboKey);
        if (qCombo) {
          qCombo.comboCount = (qCombo.comboCount || 0) + (item.comboCount || 1);
          if (item.subText) qCombo.subText = item.subText;
          this._trackBestStreak(item.user, item.giftName, qCombo.comboCount);
          return;
        }
      }

      // 2. In-Place Sub-20 Like Progress Update for Same Viewer
      if (item.progressUid && this.active && this.active.progressUid === item.progressUid && this.active.cardEl) {
        const txtEl = this.active.cardEl.querySelector(".sc-micro-txt");
        if (txtEl) {
          txtEl.innerHTML = `<b>${escHtml(item.user?.nickname || "İzleyici")}</b> ${escHtml(item.text || "")}`;
        }
        this._resetActiveTtl(item.ttl || 2400);
        return;
      }

      // 3. Burst-Coalesce Queued Halay Joins ("Kovax +N kişi halay halkasına katıldı!")
      if (item.kind === "join") {
        if (this.active && this.active.kind === "join" && this.active.cardEl) {
          this.active.extraJoins = (this.active.extraJoins || 0) + 1;
          const p = HudLangEngine.pack(HudLangEngine.current);
          const txtEl = this.active.cardEl.querySelector(".sc-micro-txt");
          if (txtEl) {
            txtEl.innerHTML = `<b>${escHtml(this.active.user?.nickname || p.guestFb)}</b> ${escHtml(p.extraJoin.replace("{n}", String(this.active.extraJoins)))}`;
          }
          this._resetActiveTtl(2500);
          return;
        }
        const qJoin = this.queue.find((q) => q.kind === "join");
        if (qJoin) {
          qJoin.extraJoins = (qJoin.extraJoins || 0) + 1;
          const p = HudLangEngine.pack(HudLangEngine.current);
          qJoin.text = p.extraJoin.replace("{n}", String(qJoin.extraJoins));
          return;
        }
      }

      // Insert sorted by priority (0 = highest)
      if (this.queue.length >= 10 && item.priority >= 2) return;
      this.queue.push(item);
      this.queue.sort((a, b) => a.priority - b.priority);

      // Preempt lower-priority active card if P0/P1 arrives over P2/P3, P2 arrives over P3, or viewer completes 20-like join over their own progress pill
      if (this.active) {
        const completedOwnProgress = item.kind === "join" && this.active.progressUid && this.active.progressUid === item.user?.id;
        const shouldPreempt =
          completedOwnProgress ||
          (this.active.priority >= 3 && item.priority <= 2) ||
          (this.active.priority >= 2 && item.priority <= 1);
        if (shouldPreempt) {
          this._dismissActive(70);
          return;
        }
      } else {
        this._next();
      }
    },

    _trackBestStreak(user, _giftName, count) {
      if (count >= 2 && count >= this.bestStreakCount) {
        this.bestStreakCount = count;
        TopDock.bestStreakText = `${user?.nickname || "İzleyici"} x${count}`;
      }
    },

    _resetActiveTtl(ttlMs) {
      clearTimeout(this.hideTimer);
      this.hideTimer = setTimeout(() => this._dismissActive(140), ttlMs);
    },

    _dismissActive(fadeMs = 140) {
      clearTimeout(this.hideTimer);
      const cur = this.active;
      this.active = null;
      if (cur && cur.cardEl) {
        cur.cardEl.classList.add("is-out");
        setTimeout(() => {
          cur.cardEl?.remove();
          syncBelowHudPositions();
          this._next();
        }, fadeMs);
      } else {
        this._next();
      }
    },

    _next() {
      if (this.active || !this.queue.length || !this.el) return;
      const item = this.queue.shift();
      this.active = item;
      this.el.innerHTML = "";
      syncBelowHudPositions();

      const card = document.createElement("div");
      card.style.setProperty("--sc-accent", item.accent || "#fde047");

      if (item.template === "rich") {
        card.className = "sc-card sc-rich";
        const av = document.createElement("canvas");
        av.className = "sc-av";
        av.width = av.height = 144;

        const mid = document.createElement("div");
        mid.className = "sc-mid";
        const fl = item.user?.flag || HudLangEngine.getUserFlag(item.user?.id) || "";
        const nick = sliceCodePoints(item.user?.nickname || item.user?.unique_id || "İzleyici", 20);
        mid.innerHTML = `
          <div class="sc-t1">
            ${item.badge ? `<span class="sc-badge">${escHtml(item.badge)}</span>` : ""}
            <span>${fl ? `${escHtml(fl)} ` : ""}${escHtml(nick)}</span>
          </div>
          <div class="sc-t2">${escHtml(item.subText || "")}</div>
        `;

        const end = document.createElement("div");
        end.className = "sc-end";
        if (item.giftIcon) {
          const gImg = document.createElement("img");
          gImg.className = "sc-gift-img";
          gImg.src = item.giftIcon;
          gImg.alt = item.giftName || "Gift";
          gImg.onerror = () => {
            if (item.emblem) {
              const fb = document.createElement("span");
              fb.className = "sc-emblem";
              fb.textContent = item.emblem;
              gImg.replaceWith(fb);
            } else {
              gImg.remove();
            }
          };
          end.appendChild(gImg);
        } else if (item.emblem) {
          const emSpan = document.createElement("span");
          emSpan.className = "sc-emblem";
          emSpan.textContent = item.emblem;
          end.appendChild(emSpan);
        }
        if (item.comboKey || (item.comboCount && item.comboCount > 1)) {
          const cSpan = document.createElement("span");
          cSpan.className = "sc-combo is-pop";
          cSpan.textContent = `x${item.comboCount || 1}`;
          end.appendChild(cSpan);
          this._trackBestStreak(item.user, item.giftName, item.comboCount || 1);
        }

        card.append(av, mid, end);
        drawAvatarToCanvas(av, item.user);
      } else {
        card.className = "sc-card sc-micro";
        if (item.noAvatar) {
          const dot = document.createElement("span");
          dot.className = "sc-dot";
          const txt = document.createElement("span");
          txt.className = "sc-micro-txt";
          txt.innerHTML = item.htmlText || escHtml(item.text || "");
          card.append(dot, txt);
        } else {
          const av = document.createElement("canvas");
          av.className = "sc-av";
          av.width = av.height = 128;
          const txt = document.createElement("span");
          txt.className = "sc-micro-txt";
          const nick = sliceCodePoints(item.user?.nickname || item.user?.unique_id || "İzleyici", 18);
          txt.innerHTML = `<b>${escHtml(nick)}</b> ${escHtml(item.text || "")}`;
          card.append(av, txt);
          drawAvatarToCanvas(av, item.user);
        }
      }

      item.cardEl = card;
      this.el.appendChild(card);
      syncBelowHudPositions();
      if (item.sfx) AlertSfx.play(item.sfx);
      this._resetActiveTtl(item.ttl || (item.template === "rich" ? 3400 : 2500));
    },

    tickPeriodicCta() {
      return;
    }
  };

  function bootUiOverlays() {
    initMinimalStyles();
    TopDock.init();
    MvpBoard.init();
    StageScheduler.init();
    DjSubtitleBar.init();
    connectLocalWs();
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootUiOverlays);
  } else {
    bootUiOverlays();
  }

  // --- Locked 60-FPS Broadcast Crisp HD Engine (Native MSAA + 2.15x SSAA + 60Hz Frame Pacer + Zero Hitch) ---
  const UltraHdGraphics = {
    mode: params.get("quality") || localStorage.getItem("divalar:gfx_mode_v22") || "hd60",
    hooked: false,
    sceneOptimized: false,
    isSoftwareGl: false,
    activePR: 1.0,
    activeSamples: 4,
    internalRes: "",

    cycleMode() {
      const order = ["hd60", "ultra", "perf"];
      this.mode = order[(order.indexOf(this.mode) + 1) % order.length];
      try { localStorage.setItem("divalar:gfx_mode_v22", this.mode); } catch (_) {}
      this.applyToEngine();
      return this.getLabel();
    },

    getLabel() {
      const names = { hd60: "60 FPS Keskin HD", perf: "Ultra Akıcı", ultra: "Sinema 2K" };
      const tag = names[this.mode] || "60 FPS Keskin HD";
      return this.internalRes ? `${tag} (${this.internalRes})` : tag;
    },

    optimizeSceneFor60Fps(eng) {
      if (this.sceneOptimized) return true;
      const meydan = window.halay?.meydan;
      const meydanGroup = meydan?.group;
      if (!eng?.scene || !meydanGroup || !Array.isArray(eng.systems) || eng.systems.length < 16) return false;
      this.sceneOptimized = true;
      try {
        // 1. Keep warm wedding lights & lock crisp 1024x1024 PCF shadow map (blocks 4096x4096 reallocation stalls!)
        if (eng.renderer?.shadowMap) {
          eng.renderer.shadowMap.type = 1; // THREE.PCFShadowMap: crisp shadows without 9-tap soft-shadow GPU stall
          eng.renderer.shadowMap.autoUpdate = false;
          if (IS_OBS_STUDIO) {
            eng.renderer.shadowMap.enabled = false;
          } else {
            eng.renderer.shadowMap.needsUpdate = true;
          }
        }
        eng.scene.traverse((o) => {
          if (o.isPointLight || o.isSpotLight) o.castShadow = false;
          if (o.isHemisphereLight) o.intensity = Math.max(o.intensity, 0.92);
          if (o.isDirectionalLight) {
            o.intensity = Math.min(o.intensity, 2.25);
            if (IS_OBS_STUDIO) {
              o.castShadow = false;
            } else if (o.shadow) {
              const shadowRes = (IS_OBS || this.isSoftwareGl) ? 512 : 1024;
              o.shadow.bias = -0.0005;
              o.shadow.mapSize.set(shadowRes, shadowRes);
              o.shadow.map?.dispose?.();
              o.shadow.map = null;
              if (!o.shadow.mapSize.__locked1024) {
                const origMapSet = o.shadow.mapSize.set.bind(o.shadow.mapSize);
                o.shadow.mapSize.set = function (sx, sy) {
                  return origMapSet(Math.min(shadowRes, sx || shadowRes), Math.min(shadowRes, sy || shadowRes));
                };
                o.shadow.mapSize.__locked1024 = true;
              }
            }
          }
        });

        // 2. Disable static border prop & speaker shadow casting (-1M+ shadow tris/frame; keeps crisp shadows on halay dancers & bride/groom!)
        const stripShadows = (grp) => grp?.traverse?.((o) => { if (o.isMesh && !o.isSkinnedMesh) o.castShadow = false; });
        stripShadows(meydanGroup);
        stripShadows(window.halay?.wanderers?.group);
        stripShadows(window.halay?.kids?.group);
        for (const ch of (eng.scene?.children || [])) {
          if (ch.name === "hoparlorler" || ch.name === "doga" || ch.name === "daglar" || ch.name === "Group") {
            stripShadows(ch);
          }
        }
        if (typeof meydan._buildRing === "function" && !meydan.__ringPatched) {
          const origBuildRing = meydan._buildRing.bind(meydan);
          meydan._buildRing = function (r) {
            const out = origBuildRing(r);
            stripShadows(this._stones);
            return out;
          };
          meydan.__ringPatched = true;
        }

        // 3. Keep lively wedding table guests (~33%), ALL wanderers, ALL kids & 100% of forest/trees (zero floating canopies!)
        const disposeChar = (c) => {
          if (!c) return;
          const rootObj = c.root || c.group || c.mesh;
          rootObj?.traverse?.((o) => { if (o.isSkinnedMesh) o.skeleton?.dispose?.(); });
          if (typeof c.dispose === "function") c.dispose();
          else rootObj?.removeFromParent?.();
        };
        const guestSys = eng.systems.find((s) => Array.isArray(s?.people) && s.people.length > 30 && !s.tags);
        if (guestSys) {
          guestSys.people.forEach((p, idx) => { if (idx % 3 !== 0) disposeChar(p); });
          guestSys.people = guestSys.people.filter((_, idx) => idx % 3 === 0);
          const bubbleSys = eng.systems.find((s) => Array.isArray(s?.people) && s.tags && s.bag);
          if (bubbleSys) bubbleSys.people = [...guestSys.people];
        }
        if (Array.isArray(meydan.shiftables)) {
          meydan.shiftables = meydan.shiftables.filter((s) => !s?.obj || s.obj.parent);
        }
        const ffSys = eng.systems.find((s) => s?.ff && s?.meydan);
        if (ffSys?.ff) ffSys.ff.visible = true;

        // 5. Reorder eng.systems (roles -> line -> ... -> para -> skinSync) so newly spawned dancers NEVER show 1-6 frames of T-pose!
        const rolesSys = window.halay?.roles;
        const lineSys = window.halay?.line;
        const skinSys = window.halay?.skinSync;
        if (rolesSys && lineSys) {
          const rIdx = eng.systems.indexOf(rolesSys);
          const lIdx = eng.systems.indexOf(lineSys);
          if (rIdx > lIdx && lIdx >= 0) {
            eng.systems.splice(rIdx, 1);
            eng.systems.splice(lIdx, 0, rolesSys);
          }
        }
        if (skinSys) {
          const sIdx = eng.systems.indexOf(skinSys);
          const paraSys = window.halay?.para;
          const pIdx = paraSys ? eng.systems.indexOf(paraSys) : -1;
          if (sIdx >= 0 && pIdx > sIdx) {
            eng.systems.splice(sIdx, 1);
            eng.systems.splice(eng.systems.indexOf(paraSys) + 1, 0, skinSys);
          }
        }

        // 6. Patch skinSync.decide once per frame so visible halay dancers keep hand-holding without forcing LOD on 60+ background guests
        if (skinSys && typeof skinSys.update === "function" && !skinSys.__ikLodPatched) {
          const promoteIkLod = () => {
            const dancers = window.halay?.line?.dancers;
            if (!Array.isArray(dancers)) return;
            let ikCount = 0;
            for (let i = 0; i < dancers.length; i++) {
              const c = dancers[i];
              if (!c) continue;
              if ((c.handTargets?.L || c.handTargets?.R) && (c._camDist ?? 0) < 14 && ikCount < 12) {
                c.lodDetail = true;
                ikCount++;
              } else {
                c.lodDetail = false;
              }
            }
          };
          if (typeof skinSys.decide === "function") {
            const origDecide = skinSys.decide.bind(skinSys);
            skinSys.decide = function () {
              const res = origDecide();
              promoteIkLod();
              return res;
            };
          } else {
            const origUpdate = skinSys.update.bind(skinSys);
            skinSys.update = function () {
              promoteIkLod();
              return origUpdate();
            };
          }
          skinSys.__ikLodPatched = true;
        }

        // 7. Natural cinematic camera with anti-extreme-closeup floor (keeps _sira & focus alive while never zooming inside faces)
        if (eng.controls) {
          eng.controls.minDistance = 4.6;
        }
        const dir = window.halay?.director;
        if (dir && typeof dir._fit === "function" && !dir.__wideCamPatched) {
          if (typeof dir._clear === "function") {
            dir._clear = function (camPos) {
              this._push = 0;
              if (camPos && camPos.y < 2.65) camPos.y = 2.65;
            };
          }
          const enforceWideFrame = (ctxRef, shotName, pos, tgt) => {
            if (!pos || !tgt) return;
            const isHalay = !shotName || shotName === "halay";
            const line = ctxRef?.line;
            const dLen = line?.dancers?.length || 0;
            const ringR = dLen && line?.rings?.radius ? line.rings.radius(line.rings.ring[dLen - 1]) : 2.3;
            const minHoriz = isHalay ? Math.max(6.8, Math.min(9.6, ringR * 1.65 + 2.35)) : 5.4;
            const maxHoriz = isHalay ? Math.max(minHoriz + 1.0, Math.min(10.8, ringR * 1.95 + 2.95)) : 7.8;
            const pull = isHalay ? 1.05 : 1.18;
            let vx = pos.x - tgt.x;
            let vz = pos.z - tgt.z;
            let hDist = Math.hypot(vx, vz);
            if (hDist < 0.001) {
              vx = 1;
              vz = 0;
              hDist = 1;
            }
            const rawScale = Math.max(pull, minHoriz / hDist);
            const clampedDist = Math.min(maxHoriz, hDist * rawScale);
            const scale = clampedDist / hDist;
            let nx = tgt.x + vx * scale;
            let nz = tgt.z + vz * scale;
            const maxR = (ctxRef?.meydan?.radius || 9.5) + 2.2;
            const r = Math.hypot(nx, nz);
            if (r > maxR) {
              nx *= maxR / r;
              nz *= maxR / r;
            }
            const postHDist = Math.hypot(nx - tgt.x, nz - tgt.z);
            if (postHDist < minHoriz - 0.15) {
              const inAng = Math.atan2(-tgt.z, -tgt.x);
              nx = tgt.x + Math.cos(inAng) * minHoriz;
              nz = tgt.z + Math.sin(inAng) * minHoriz;
            }
            const minY = isHalay ? Math.min(4.8, 3.45 + Math.max(0, ringR - 2.2) * 0.45) : 2.95;
            const maxY = isHalay ? 5.6 : 4.4;
            const ny = Math.min(maxY, Math.max(pos.y, minY));
            pos.set(nx, ny, nz);
            if (isHalay) {
              tgt.y = Math.max(tgt.y, 1.82);
            } else {
              tgt.y = Math.max(tgt.y, 1.25);
            }
          };
          const origFit = dir._fit.bind(dir);
          dir._fit = function (out) {
            origFit(out);
            if (!out?.pos || !out?.target) return;
            enforceWideFrame(this.ctx, this.shot?.name || "halay", out.pos, out.target);
            if (out.fov < 52) out.fov = (!this.shot?.name || this.shot.name === "halay") ? 54 : 52;
          };
          if (typeof dir.update === "function") {
            const origDirUpdate = dir.update.bind(dir);
            let _smoothOrbitAz = 0.48;
            let _smoothOrbitDist = 7.8;
            let _smoothOrbitY = 3.85;
            let _lastCamMode = "";
            let _lastTagBucket = -1;
            dir.update = function (dt) {
              const camMode = StageDirector.camera || "auto";
              const isHalay = !this.shot?.name || this.shot.name === "halay";
              if (!this.enabled || this.manual || !this.cam || !this.target) {
                _lastCamMode = camMode;
                return origDirUpdate(dt);
              }
              const line = this.ctx?.line;
              const dLen = line?.dancers?.length || 0;
              const ringR = dLen && line?.rings?.radius ? line.rings.radius(line.rings.ring[dLen - 1]) : 2.3;
              const safeDt = Math.min(0.05, Math.max(0.001, Number(dt || 0.016)));

              if (camMode === "auto" && isHalay && _lastCamMode && _lastCamMode !== "auto") {
                const dx0 = this.cam.position.x - this.target.x;
                const dz0 = this.cam.position.z - this.target.z;
                const hd0 = Math.hypot(dx0, dz0);
                if (hd0 > 0.5) {
                  _smoothOrbitAz = Math.atan2(dz0, dx0);
                  _smoothOrbitDist = hd0;
                  _smoothOrbitY = this.cam.position.y;
                }
              }
              _lastCamMode = camMode;

              if (camMode === "drone" && isHalay) {
                StageDirector._droneAngle = (StageDirector._droneAngle + safeDt * 0.24) % (Math.PI * 2);
                const rad = Math.max(8.2, ringR * 1.8 + 2.2);
                const k = 1 - Math.exp(-6.0 * safeDt);
                this.target.x += (0 - this.target.x) * k;
                this.target.y += (1.82 - this.target.y) * k;
                this.target.z += (0 - this.target.z) * k;
                this.cam.position.x += (this.target.x + Math.cos(StageDirector._droneAngle) * rad - this.cam.position.x) * k;
                this.cam.position.y += (4.55 - this.cam.position.y) * k;
                this.cam.position.z += (this.target.z + Math.sin(StageDirector._droneAngle) * rad - this.cam.position.z) * k;
                if (this.cam.fov !== 55) {
                  this.cam.fov = 55;
                  this.cam.updateProjectionMatrix();
                }
                this.cam.lookAt(this.target);
                return;
              }

              if (camMode === "auto" && isHalay) {
                // Continuous smooth orbital sweep (zero origDirUpdate tug-of-war, zero preset jumps)
                const crowdMargin = dLen >= 26 ? 0.65 : 0.25;
                const floorHoriz = Math.max(6.4, Math.min(9.6, ringR * 1.58 + 2.15 + crowdMargin));
                const ceilHoriz = Math.max(floorHoriz + 1.2, Math.min(11.2, ringR * 1.95 + 3.0 + crowdMargin));
                const floorY = Math.min(4.7, 3.35 + Math.max(0, ringR - 2.2) * 0.42);
                _smoothOrbitAz = (_smoothOrbitAz + safeDt * 0.14) % (Math.PI * 2);
                const pulse = Math.sin(performance.now() * 0.00028);
                const waveDist = ((floorHoriz + ceilHoriz) * 0.5) + Math.sin(_smoothOrbitAz) * ((ceilHoriz - floorHoriz) * 0.38) + pulse * 0.85;
                const waveY = floorY + 0.55 + Math.cos(_smoothOrbitAz * 2.0) * 0.35 - pulse * 0.25;
                _smoothOrbitDist += (waveDist - _smoothOrbitDist) * (1 - Math.exp(-2.2 * safeDt));
                _smoothOrbitY += (waveY - _smoothOrbitY) * (1 - Math.exp(-2.2 * safeDt));

                const kTgt = 1 - Math.exp(-3.5 * safeDt);
                this.target.x += (0 - this.target.x) * kTgt;
                this.target.y += (1.58 - this.target.y) * kTgt;
                this.target.z += (0 - this.target.z) * kTgt;

                const kPos = 1 - Math.exp(-4.5 * safeDt);
                const wantX = this.target.x + Math.cos(_smoothOrbitAz) * _smoothOrbitDist;
                const wantZ = this.target.z + Math.sin(_smoothOrbitAz) * _smoothOrbitDist;
                this.cam.position.x += (wantX - this.cam.position.x) * kPos;
                this.cam.position.y += (_smoothOrbitY - this.cam.position.y) * kPos;
                this.cam.position.z += (wantZ - this.cam.position.z) * kPos;
                StageDirector._autoPreset = "smooth_orbit";
                StageDirector._autoOrbit = _smoothOrbitAz;
                if (this.cam.fov < 53) {
                  this.cam.fov = 53;
                  this.cam.updateProjectionMatrix();
                }
                const tagBucket = dLen >= 36 ? 2 : (dLen >= 26 ? 1 : 0);
                if (tagBucket !== _lastTagBucket) {
                  _lastTagBucket = tagBucket;
                  const tu = this.ctx?.tags?.uniforms;
                  if (tu?.uMax?.value?.set) {
                    tu.uMax.value.set(tagBucket === 2 ? 58 : (tagBucket === 1 ? 72 : 88), tagBucket === 2 ? 82 : (tagBucket === 1 ? 98 : 118));
                  }
                }
                this.cam.lookAt(this.target);
                return;
              }

              origDirUpdate(dt);
              let floorHoriz = Math.max(7.2, ringR * 1.45);
              let ceilHoriz = floorHoriz + 2.8;
              let floorY = 3.6;
              let minFov = 50;
              if (camMode === "wide") {
                floorHoriz = Math.max(9.6, ringR * 2.0 + 3.2);
                ceilHoriz = floorHoriz + 1.8;
                floorY = 5.1;
                minFov = 56;
              } else if (camMode === "leader") {
                const leadObj = line?.dancers?.[0]?.group || line?.dancers?.[0]?.root;
                if (leadObj?.position) {
                  const kLead = 1 - Math.exp(-8.5 * safeDt);
                  this.target.x += (leadObj.position.x - this.target.x) * kLead;
                  this.target.z += (leadObj.position.z - this.target.z) * kLead;
                }
                floorHoriz = 5.4;
                ceilHoriz = 6.6;
                floorY = 3.0;
              }
              const dx = this.cam.position.x - this.target.x;
              const dz = this.cam.position.z - this.target.z;
              const hd = Math.hypot(dx, dz) || 0.001;
              let changed = false;
              let fovChanged = false;
              if (hd < floorHoriz) {
                const k = floorHoriz / hd;
                this.cam.position.x = this.target.x + dx * k;
                this.cam.position.z = this.target.z + dz * k;
                changed = true;
              } else if (hd > ceilHoriz) {
                const k = ceilHoriz / hd;
                this.cam.position.x = this.target.x + dx * k;
                this.cam.position.z = this.target.z + dz * k;
                changed = true;
              }
              if (this.cam.position.y < floorY) {
                this.cam.position.y = floorY;
                changed = true;
              }
              const minTgtY = camMode === "leader" ? 1.48 : (isHalay ? 1.78 : 1.22);
              if (this.target.y < minTgtY) {
                this.target.y = minTgtY;
                changed = true;
              }
              if (this.cam.fov < minFov) {
                this.cam.fov = minFov;
                fovChanged = true;
              }
              if (changed) {
                this.cam.lookAt(this.target);
              }
              if (fovChanged) {
                this.cam.updateProjectionMatrix();
              }
            };
          }
          dir.__wideCamPatched = true;
        }

        // 8. Crisp 3D overhead nameplates (NEVER touch uP0..uP5 GPU atlases with needsUpdate!)
        const tagsSys = window.halay?.tags;
        const tagUniforms = tagsSys?.uniforms;
        if (tagUniforms) {
          const dCount = window.halay?.line?.dancers?.length || 0;
          if (tagUniforms.uRef) tagUniforms.uRef.value = 6.2;
          if (tagUniforms.uMax?.value?.set) {
            tagUniforms.uMax.value.set(dCount >= 36 ? 58 : (dCount >= 26 ? 72 : 88), dCount >= 36 ? 82 : (dCount >= 26 ? 98 : 118));
          }
        }
        const avMgr = tagsSys?.avatars;
        if (avMgr && typeof avMgr._load === "function" && !avMgr.__whiteGuardPatched) {
          const origLoad = avMgr._load.bind(avMgr);
          avMgr._load = async function (user) {
            const cnv = await origLoad(user);
            if (!cnv || cnv.placeholder || typeof cnv.getContext !== "function") return cnv;
            try {
              const cw = cnv.width || 96;
              const ch = cnv.height || 96;
              const ctx2d = cnv.getContext("2d", { willReadFrequently: true });
              const buf = ctx2d.getImageData(0, 0, cw, ch).data;
              const pts = [Math.floor(cw * 0.21), Math.floor(cw * 0.5), Math.floor(cw * 0.79)];
              let nearWhite = 0;
              for (let yi = 0; yi < 3; yi++) {
                const rowOff = pts[yi] * cw;
                for (let xi = 0; xi < 3; xi++) {
                  const idx = (rowOff + pts[xi]) * 4;
                  const r = buf[idx], g = buf[idx + 1], b = buf[idx + 2], a = buf[idx + 3];
                  const mn = r < g ? (r < b ? r : b) : (g < b ? g : b);
                  const mx = r > g ? (r > b ? r : b) : (g > b ? g : b);
                  if (a < 25 || (mn >= 235 && mx - mn <= 12)) nearWhite++;
                }
              }
              if (nearWhite >= 8) return this.constructor.initial(user);
            } catch (_) {}
            return cnv;
          };
          avMgr.__whiteGuardPatched = true;
        }
      } catch (e) {
        console.warn("[UltraHdGraphics:SceneDiet]", e);
      }
      return true;
    },

    sweepAnisotropy(eng) {
      try {
        const capAniso = (IS_OBS || IS_OBS_STUDIO) ? 4 : 8;
        const maxAniso = Math.min(capAniso, eng.renderer?.capabilities?.getMaxAnisotropy?.() || 4);
        const texKeys = ["map", "normalMap", "roughnessMap", "metalnessMap", "aoMap", "emissiveMap"];
        const boostTex = (t) => {
          // CRITICAL: Never set needsUpdate on shrunk 1x1 GPU copyTextureToTexture atlases (e.g. tagsSys uP0..uP5)!
          if (t && t.isTexture && !t.__uhdAniso && t.anisotropy !== maxAniso && (!t.image || (t.image.width > 2 && t.image.height > 2))) {
            t.anisotropy = maxAniso;
            t.__uhdAniso = true;
            t.needsUpdate = true;
          }
        };
        const visit = (root) => {
          root?.traverse?.((obj) => {
            if (!obj.material) return;
            const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
            for (const m of mats) {
              for (const k of texKeys) boostTex(m?.[k]);
            }
          });
        };
        visit(eng.scene);
      } catch (_) {}
    },

    applyToEngine() {
      const eng = window.halay?.engine;
      if (!eng || !eng.renderer || !eng.composer) return false;
      try {
        const gl = eng.renderer.getContext?.();
        if (gl && !this._checkedGl) {
          this._checkedGl = true;
          const dbg = gl.getExtension("WEBGL_debug_renderer_info");
          const rendererStr = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || "") : "";
          this.isSoftwareGl = /SwiftShader|llvmpipe|Software/i.test(rendererStr);
        }

        this.optimizeSceneFor60Fps(eng);

        const w = Math.max(360, window.innerWidth || 1080);
        const h = Math.max(360, window.innerHeight || 1920);
        const area = w * h;

        let targetPR = 1.0;

        if (this.isSoftwareGl || this.mode === "perf") {
          targetPR = h >= 1280 ? 0.67 : 1.0;
        } else if (IS_OBS || IS_OBS_STUDIO) {
          // OBS / TikTok LIVE Studio: cap DPR at 1.0 (or 1.15 on ultra-narrow viewports) so CEF broadcast capture stays locked at 60FPS!
          targetPR = w < 440 ? 1.1 : 1.0;
        } else if (this.mode === "ultra") {
          targetPR = h <= 1120 ? 1.5 : 1.2;
        } else {
          // hd60 (Default): Locked 60FPS
          targetPR = IS_MOBILE
            ? Math.min(Math.max(NATIVE_DPR, 1.15), 1.35)
            : (h <= 1120 ? 1.25 : 1.05);
        }

        eng._adapt = function () {};
        eng.maxPixelRatio = targetPR;
        eng.pixelRatio = targetPR;

        if (eng.bloom) {
          eng.bloom.enabled = false;
        }
        eng.renderer.toneMappingExposure = 0.96;

        // Bypass EffectComposer's 0x-MSAA offscreen HalfFloat pass -> render directly to native hardware-MSAA backbuffer!
        if (!eng.composer.__directMsaaPatched) {
          eng.composer.render = function () {
            const tStart = performance.now();
            if (eng.renderer?.shadowMap && eng.renderer.shadowMap.enabled && !eng.renderer.shadowMap.autoUpdate) {
              eng.renderer.shadowMap.needsUpdate = true;
            }
            eng.renderer.setRenderTarget(null);
            eng.renderer.render(eng.scene, eng.camera);
            UltraHdGraphics._lastRenderMs = performance.now() - tStart;
          };
          eng.composer.setSize = function () {};
          eng.composer.renderTarget1?.dispose?.();
          eng.composer.renderTarget2?.dispose?.();
          eng.composer.__directMsaaPatched = true;
        }

        // Native hardware vsync pacing: eliminates 55/120 zero-move camera freeze frames on 144Hz/OBS displays!

        eng.renderer.setPixelRatio(targetPR);
        eng._resize();

        const domCnv = eng.renderer.domElement;
        if (domCnv?.style) {
          domCnv.style.imageRendering = "auto";
        }

        this.activePR = targetPR;
        this.activeSamples = this.isSoftwareGl ? 0 : 4;
        this.internalRes = `${Math.round(w * targetPR)}×${Math.round(h * targetPR)}${this.activeSamples ? " • 4xMSAA" : ""}`;
        this.sweepAnisotropy(eng);

        if (!this.hooked) {
          this.hooked = true;
          window.addEventListener("resize", () => setTimeout(() => this.applyToEngine(), 80));
          const sceneDietPoll = setInterval(() => {
            if (this.optimizeSceneFor60Fps(eng)) {
              this.sweepAnisotropy(eng);
              clearInterval(sceneDietPoll);
            }
          }, 250);
          setTimeout(() => clearInterval(sceneDietPoll), 15000);
          setTimeout(() => this.sweepAnisotropy(eng), 2400);
          this.startFpsGuard();
        }
        return true;
      } catch (err) {
        console.warn("[UltraHdGraphics]", err);
        return false;
      }
    },

    startFpsGuard() {
      if (this._fpsWatchdogStarted) return;
      this._fpsWatchdogStarted = true;

      // Auto-unlock accidental OBS manual camera pan without disposing shadow maps
      setInterval(() => {
        if (IS_OBS && window.halay?.director?.manual) {
          window.halay.director.manual = false;
        }
      }, 9000);
      // Hardware GPUs (RTX 4060 / Radeon 780M) keep locked crisp SSAA + 4x MSAA without false 30fps-capture downgrades!
    }
  };
  window.__halayGfx = UltraHdGraphics;

  const gfxBootTimer = setInterval(() => {
    if (UltraHdGraphics.applyToEngine()) clearInterval(gfxBootTimer);
  }, 220);

  // Intercept bundle's internal feed.push so zero duplicate/unbounded rows render
  const feedHookTimer = setInterval(() => {
    if (window.halay?.feed && !window.halay.feed._hookedV6) {
      window.halay.feed._hookedV6 = true;
      clearInterval(feedHookTimer);
      window.halay.feed.push = function (act, user) {
        const uid = String(user?.id || user?.uid || user?.uniqueId || "anon");
        if (act === "katil" || act === "join") {
          joinedUsers.add(uid);
          TopDock.refreshDancerCount();
          const pJoin = HudLangEngine.pack(HudLangEngine.current);
          StageScheduler.enqueue({
            priority: 2, kind: "join", template: "micro", accent: "#c084fc",
            user, text: pJoin.joined || "halay halkasına katıldı! 🕺", sfx: "join", dedupKey: `join:${uid}`, ttl: 2400
          });
        }
      };
    }
  }, 800);

  let vipLeaderLockUntil = 0;
  let wsPingTimer = null;
  let pendingSeedPayload = null;
  const pendingRoleSpawns = [];

  function buildCanonUser(user) {
    const roles = window.halay?.roles;
    const live = window.halay?.live;
    const uid = String(user?.id || user?.unique_id || "anon");
    const safeAv = user?.avatar_url
      || (typeof user?.avatar === "string" ? user.avatar : null)
      || (typeof user?.avatar?.small === "string" ? user.avatar.small : null);
    const base = {
      id: uid,
      uniqueId: String(user?.unique_id || uid),
      nickname: sliceCodePoints(user?.nickname || user?.unique_id || "İzleyici", 20),
      avatar: safeAv,
      secUid: String(user?.secUid || uid),
      platformId: uid
    };
    const rawCanon = live?._user ? live._user({ ...user, avatar: safeAv, avatar_url: safeAv }) : base;
    if (rawCanon && typeof rawCanon.avatar !== "string") rawCanon.avatar = safeAv;
    return roles?._canon ? roles._canon(rawCanon) : rawCanon;
  }

  function normalizeEngineGender(g) {
    if (g === "kadin" || g === "kiz") return "kadin";
    if (g === "erkek") return "erkek";
    return "";
  }

  let _lastStageOrderKey = "";
  function applyStageOrder(stageOrder) {
    const line = window.halay?.line;
    if (!line || !Array.isArray(line.dancers) || !Array.isArray(stageOrder) || !stageOrder.length) return;
    const leaderId = window.halay?.roles?.leaderId ? String(window.halay.roles.leaderId) : "";
    const key = leaderId + "|" + stageOrder.join(",");
    if (key === _lastStageOrderKey) return;
    _lastStageOrderKey = key;
    const rankMap = new Map();
    stageOrder.forEach((id, idx) => rankMap.set(String(id), idx));
    line.dancers.sort((a, b) => {
      const ida = String(a?.viewer?.id || a?.id || "");
      const idb = String(b?.viewer?.id || b?.id || "");
      if (leaderId && ida === leaderId && idb !== leaderId) return -1;
      if (leaderId && idb === leaderId && ida !== leaderId) return 1;
      const ra = rankMap.has(ida) ? rankMap.get(ida) : 9999;
      const rb = rankMap.has(idb) ? rankMap.get(idb) : 9999;
      return ra - rb;
    });
  }

  function seedDancerInstant(user) {
    const roles = window.halay?.roles;
    const line = window.halay?.line;
    if (!roles || !line || typeof line.addDancer !== "function") return false;
    const canon = buildCanonUser(user);
    if (roles._find?.(canon.id)) return true;
    const engGender = normalizeEngineGender(user?.gender);
    if (engGender) {
      roles.gender?.set?.(canon.id, engGender);
    }
    let replaced = false;
    if ((line.total ?? line.dancers?.length ?? 0) >= (TopDock.maxSeats || line.limit || 24)) {
      const victim = roles._victim?.(true, performance.now())
        || ((line.dancers?.length || 0) > 1 ? line.dancers[line.dancers.length - 1] : null);
      if (!victim || victim === line.dancers?.[0]) return false;
      line.removeDancer?.(victim, { walk: false });
      replaced = true;
    }
    const gender = engGender || (roles.settings?.genderSwap ? roles.gender?.get?.(canon.id) : undefined);
    const c = line.addDancer({}, { id: canon.id, gender, walkIn: false, replace: replaced });
    if (!c) return false;
    c.viewer = canon;
    c.joinedAt = performance.now();
    roles.active?.set?.(canon.id, performance.now());
    roles.joinVia?.set?.(canon.id, "like");
    c.lodDetail = true;
    c.updateDriver?.();
    c.syncSkin?.();
    const roleTag = (line.dancers?.[0] === c && canon.id === roles.leaderId) ? "halaybasi" : "normal";
    roles.tags?.set?.(c, canon, roleTag);
    return true;
  }

  function applyCostumeSwap(user, targetGender) {
    const engGender = normalizeEngineGender(targetGender);
    if (!engGender) return false;
    const built = buildUser({ ...user, gender: engGender });
    built.gender = engGender;
    const roles = window.halay?.roles;
    const line = window.halay?.line;
    if (!roles || !line) {
      pendingRoleSpawns.push({ action: "costume", user: built, gender: engGender });
      return false;
    }
    const canon = buildCanonUser(built);
    for (let i = pendingRoleSpawns.length - 1; i >= 0; i--) {
      if (pendingRoleSpawns[i]?.action === "katil" && pendingRoleSpawns[i]?.user?.id === built.id) {
        pendingRoleSpawns.splice(i, 1);
      }
    }
    if (Array.isArray(roles.queue)) {
      roles.queue = roles.queue.filter((q) => q?.id !== canon.id);
    }
    roles.gender?.set?.(canon.id, engGender);
    roles._swapAt?.delete?.(canon.id);
    roles._swapQueue?.delete?.(canon.id);
    roles.active?.set?.(canon.id, performance.now());

    const findOnStage = () => roles._find?.(canon.id)
      || roles.charOf?.(canon.id)
      || line.dancers?.find?.((d) => d?.viewer?.id === canon.id)
      || (line.joiners?.find?.((j) => (j?.c || j)?.viewer?.id === canon.id)?.c)
      || (line.walkers?.find?.((w) => (w?.c || w)?.viewer?.id === canon.id)?.c)
      || null;

    let ch = findOnStage();
    const wasOnStage = !!ch;
    if (!ch) {
      joinedUsers.add(built.id);
      seedDancerInstant(built);
      ch = findOnStage();
      TopDock.refreshDancerCount();
    }
    if (ch) {
      const nowTs = performance.now();
      const justSetSame = (ch.model?.meta?.cinsiyet === engGender) && ((nowTs - (ch._lastCostumeTs || 0)) < 250);
      if ((wasOnStage || ch.model?.meta?.cinsiyet !== engGender) && !justSetSame && typeof line.swapGender === "function") {
        line.swapGender(ch, engGender);
        roles.tags?.remeasure?.(ch);
        roles.onSwap?.(ch);
      }
      ch._lastCostumeTs = nowTs;
      ch.lodDetail = true;
      ch.updateDriver?.();
      ch.syncSkin?.();
      return true;
    }
    return false;
  }

  function flushSeedPayload() {
    if (!pendingSeedPayload) return;
    const roles = window.halay?.roles;
    const line = window.halay?.line;
    if (!roles || !line || typeof line.addDancer !== "function") return;
    const payload = pendingSeedPayload;
    pendingSeedPayload = null;
    for (const rawUser of (payload.users || [])) {
      const user = buildUser(rawUser);
      joinedUsers.add(user.id);
      if (!userLikeTotals.has(user.id)) userLikeTotals.set(user.id, likeThreshold);
      seedDancerInstant(user);
    }
    const vipMap = payload.roles || {};
    for (const act of ["halaybasi", "davulcu", "zurnaci", "gelin", "damat"]) {
      const rawVip = vipMap[act];
      if (!rawVip) continue;
      const vipUser = buildUser(rawVip);
      joinedUsers.add(vipUser.id);
      const canon = buildCanonUser(vipUser);
      roles._silent?.add?.(canon.id);
      roles.run(act, canon, "gift", 1);
      TopDock.setRoleHolder(act, vipUser.nickname);
    }
    TopDock.refreshDancerCount();
    try {
      window.halay?.skinSync?.decide?.();
    } catch (_) {}
  }

  setInterval(() => {
    if (pendingSeedPayload && window.halay?.roles && window.halay?.line) {
      flushSeedPayload();
    }
    if (!pendingRoleSpawns.length || !window.halay?.roles) return;
    if ((window.halay?.line?.joiners?.length || 0) >= 8) return;
    const item = pendingRoleSpawns.shift();
    if (item?.action === "costume") applyCostumeSwap(item.user, item.gender);
    else if (item) triggerEngineRole(item.action, item.user, item.via, item.count);
  }, 95);

  function enqueueRoleSpawn(action, user, via = "like", count = 1) {
    const uid = String(user?.id || user?.unique_id || "");
    if (action === "katil" && uid && pendingRoleSpawns.some((x) => x.action === "katil" && x.user?.id === uid)) return;
    pendingRoleSpawns.push({ action, user, via, count });
  }

  function triggerEngineRole(action, user, via = "gift", count = 1) {
    try {
      const roles = window.halay?.roles;
      if (!roles) {
        enqueueRoleSpawn(action, user, via, count);
        return false;
      }
      const canon = buildCanonUser(user);
      if (action === "katil") {
        if (roles._find?.(canon.id) || roles.queue?.some?.((q) => q?.id === canon.id) ||
            window.halay?.line?.joiners?.some?.((j) => (j?.c || j)?.viewer?.id === canon.id) ||
            window.halay?.line?.walkers?.some?.((w) => (w?.c || w)?.viewer?.id === canon.id)) {
          return true;
        }
      } else if (action === "halaybasi" && Array.isArray(roles.queue)) {
        roles.queue = roles.queue.filter((q) => q?.id !== canon.id);
      }
      roles.run(action, canon, via, count);
      const c = roles._find?.(canon.id);
      if (c) {
        c.lodDetail = true;
        c.updateDriver?.();
        c.syncSkin?.();
      }
      return true;
    } catch (_) {
      return false;
    }
  }

  const _roleCelebrateAt = {};
  function triggerRoleCelebration(action, user) {
    try {
      const h = window.halay;
      if (!h) return;
      const now = Date.now();
      if (now - (_roleCelebrateAt[action] || 0) < 2500) return;
      _roleCelebrateAt[action] = now;
      const canon = buildCanonUser(user);
      const ch = h.roles?._find?.(canon.id) || (action === "halaybasi" ? h.line?.dancers?.[0] : null);
      if (action === "katil" && ch) {
        h.director?.spotlight?.(ch);
        return;
      }
      if ((action === "gelin" || action === "damat")) {
        const person = ch || h.couple?.people?.find?.((p) => p?.viewer?.id === canon.id) || h.couple?.people?.[0];
        if (person) {
          h.para?.confetti?.burst?.(person.root?.position || person.root, action);
          h.couple?.cheer?.(person);
          h.director?.celebrate?.(person);
        }
        return;
      }
      if (action === "davulcu" || action === "zurnaci") {
        const mus = h.musicians?.[action] || ch;
        const other = h.musicians?.[action === "zurnaci" ? "davulcu" : "zurnaci"] || null;
        if (mus) {
          h.para?.confetti?.burst?.(mus.root, action);
          h.director?.celebrate?.(mus, other);
        }
        return;
      }
      if (action === "halaybasi") {
        const lead = ch || h.line?.dancers?.[0];
        if (lead) {
          h.para?.confetti?.burst?.(lead.root?.position || lead.root, "halaybasi");
          h.line?.celebrateLeader?.();
          h.director?.celebrate?.(lead, h.line?.dancers?.[1] || null);
        }
      }
    } catch (_) {}
  }

  function applyTikoyunSettings(msg) {
    try {
      const h = window.halay;
      if (!h) return;
      if (msg.action === "halayreset") {
        h.roles?.reset?.();
        joinedUsers.clear();
        pendingRoleSpawns.length = 0;
        TopDock?.refreshDancerCount?.();
        return;
      }
      if (msg.action === "reset_defaults") {
        h.settings?.resetDefaults?.();
        return;
      }
      if (typeof h.settings?.update === "function") {
        h.settings.update((draft) => {
          if (msg.maxDancers != null) draft.maxDancers = Math.max(20, Math.min(200, Number(msg.maxDancers) || 200));
          if (msg.paraSeconds != null) draft.paraSeconds = Math.max(2, Math.min(30, Number(msg.paraSeconds) || 5));
          if (msg.camera === "sinematik" || msg.camera === "serbest") draft.camera = msg.camera;
          if (msg.format === "dikey" || msg.format === "yatay") draft.format = msg.format;
          if (typeof msg.genderSwap === "boolean") draft.genderSwap = msg.genderSwap;
          if (Array.isArray(msg.rules)) draft.rules = msg.rules;
        });
      }
    } catch (_) {}
  }

  let _worldTimers = {};
  function triggerWorldFx(fx, user) {
    try {
      const h = window.halay;
      if (!h) return;
      const mode = String(fx || "").toLowerCase();
      if (mode === "fireflies" && h.nature?.ff?.points) {
        h.nature.group && (h.nature.group.visible = true);
        h.nature.ff.points.visible = true;
        if (h.nature.ff.points.material) {
          h.nature.ff.points.material.size = 0.42;
          h.nature.ff.points.material.opacity = 1.0;
        }
        clearTimeout(_worldTimers.ff);
        _worldTimers.ff = setTimeout(() => {
          try { if (h.nature?.ff?.points?.material) h.nature.ff.points.material.size = 0.15; } catch (_) {}
        }, 15000);
      } else if (mode === "birds" && h.nature?.flock) {
        if (h.nature.group) h.nature.group.visible = true;
        if (h.nature.flock.group) {
          h.nature.flock.group.visible = true;
          h.nature.flock.group.scale.setScalar(1.35);
        }
        h.nature.flock.active = false;
        h.nature.flock.next = h.nature.time || 0;
        clearTimeout(_worldTimers.birds);
        _worldTimers.birds = setTimeout(() => {
          try { h.nature?.flock?.group?.scale?.setScalar?.(1.0); } catch (_) {}
        }, 15000);
      } else if (mode === "kids" && h.kids) {
        if (h.kids.group) h.kids.group.visible = true;
        if (Array.isArray(h.kids.kids)) {
          h.kids.kids.forEach((k) => { k.root && (k.root.visible = true); k.pace = 2.2; });
        }
        clearTimeout(_worldTimers.kids);
        _worldTimers.kids = setTimeout(() => {
          try { h.kids?.kids?.forEach?.((k) => { k.pace = 1.0; }); } catch (_) {}
        }, 15000);
      } else if (mode === "wanderers" && h.wanderers) {
        if (h.wanderers.group) h.wanderers.group.visible = true;
        if (Array.isArray(h.wanderers.people)) {
          h.wanderers.people.forEach((p) => { p.root && (p.root.visible = true); p.until = 0; });
        }
      } else if ((mode === "banquet" || mode === "banquet_toggle") && Array.isArray(h.meydan?.banquet?.groups)) {
        const groups = h.meydan.banquet.groups;
        const anyHidden = groups.some((g) => !g.visible);
        groups.forEach((g) => { g.visible = anyHidden; });
      } else if (mode === "para_throw") {
        const u = buildCanonUser(user || { id: "host-para", nickname: "Meydan" });
        if (typeof h.para?.add === "function") h.para.add(u, 3, "para");
      }
      const fxMeta = {
        fireflies: ["✨ Ateşböcekleri!", "#fde047"],
        birds: ["🕊️ Kuş Sürüsü!", "#38bdf8"],
        kids: ["👧 Çocuklar Coştu!", "#f472b6"],
        wanderers: ["🧑‍🌾 Köy Canlandı!", "#34d399"],
        banquet: ["🍽️ Ziyafet Masaları!", "#fbbf24"],
        banquet_toggle: ["🍽️ Ziyafet Masaları!", "#fbbf24"],
        para_throw: ["💸 3D Para Saçıldı!", "#34d399"]
      }[mode];
      if (fxMeta) {
        const toastUser = user?.nickname ? buildUser(user) : { id: `fx-${mode}`, nickname: "Meydan", avatar_url: "" };
        StageScheduler.enqueue({
          priority: 2, kind: "world_fx", template: "micro", accent: fxMeta[1],
          user: toastUser, text: fxMeta[0], dedupKey: `wfx:${mode}:${toastUser.id}`, ttl: 2400
        });
      }
    } catch (_) {}
  }

  function resolveGiftActions(g) {
    const gid = Number(g.id || 0);
    const low = String(g.name || "").toLowerCase().trim();
    const unit = Number(g.diamond_unit || g.totalDiamonds || 1);
    if (gid === 5502) return ["halaybasi", "parasac"];
    if (gid === 5924 || gid === 6968 || gid === 5660) return ["gelin"];
    if (gid === 6097) return ["damat"];
    if (gid === 11495 || gid === 9575) return ["konfeti"];
    if (gid === 5303) return ["zurnaci"];
    if (gid === 5879) return ["halaybasi"];
    if (gid === 5658) return ["davulcu"];
    if (gid === 5487) return ["katil", "konfeti"];
    if (gid === 5655) return ["katil"];

    if (low.includes("küçük taç") || low.includes("little crown") || low.includes("krönchen") || low.includes("маленькая корона") || low.includes("petite couronne")) return ["damat"];
    if (low === "taç" || low === "crown" || low === "корона" || low === "couronne" || low.includes("galaksi") || low.includes("galaxy") || low.includes("aslan") || low.includes("lion")) return ["halaybasi", "parasac"];
    if (low.includes("elle kalp") || low.includes("hand heart") || low.includes("handherz") || low.includes("händen") || low.includes("сердце руками") || low.includes("coeur avec")) return ["gelin"];
    if (low.includes("aile") || low.includes("family") || low.includes("familie") || low.includes("семья") || low.includes("famille")) return ["konfeti"];
    if (low.includes("çay") || low.includes("turkish tea") || low === "tea" || low.includes("чай") || low === "thé") return ["zurnaci"];
    if (low.includes("donat") || low.includes("donut") || low.includes("doughnut") || low.includes("пончик")) return ["halaybasi"];
    if (low.includes("parfüm") || low.includes("perfume") || low.includes("parfum") || low.includes("духи")) return ["davulcu"];
    if (low.includes("parmak kalp") || low.includes("finger heart") || low.includes("fingerherz") || low.includes("пальцы")) return ["katil", "konfeti"];
    if (low === "gül" || low === "rose" || low === "rosa" || low === "роза") return ["katil"];

    if (unit >= 199) return ["halaybasi", "parasac"];
    if (unit >= 90) return ["konfeti"];
    if (unit >= 50) return ["zurnaci"];
    if (unit >= 30) return ["halaybasi"];
    if (unit >= 20) return ["davulcu"];
    if (unit >= 5) return ["katil", "konfeti"];
    return ["katil"];
  }

  function translateCostumeChat(rawText) {
    const clean = String(rawText || "").trim();
    const low = clean.toLowerCase().replace(/\u0307/g, "");
    if (/^(1|k[ıi]z|kad[ıi]n|stil\s*1|kost[uü]m\s*1|han[ıi]m|pembe|gelin\s*taraf[ıi]|girl|woman|female|девушка|женщина|девочка|fille|frau|chica|qiz)$/iu.test(low)) return "kadin";
    if (/^(2|erkek|efe|stil\s*2|kost[uü]m\s*2|mavi|damat\s*taraf[ıi]|o[ğg]lan\s*evi|boy|man|male|парень|мужчина|мальчик|garcon|garçon|mann|chico|oglan)$/iu.test(low)) return "erkek";
    if (low === "kız evi" || low === "kiz evi") return "gelin evi";
    return clean;
  }

  function isLocalAdminHost() {
    const h = String(window.location.hostname || "").toLowerCase();
    return h === "127.0.0.1" || h === "localhost" || h.startsWith("192.168.") || h.startsWith("10.");
  }

  function connectLocalWs() {
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    ws = new WebSocket(`${proto}//${window.location.host}/ws`);
    sdkState.wsStatus = "connecting";

    ws.addEventListener("open", () => {
      sdkState.wsStatus = "ready";
      emit("ready", {});
      emit("connect", {});
      emit("stream_status", { event_id: nextEventId("status"), data: { status: "live" } });
      ensureGiftCatalog();
      clearInterval(wsPingTimer);
      wsPingTimer = setInterval(() => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          try { ws.send(JSON.stringify({ action: "ping" })); } catch (_) {}
        }
      }, 25000);
    });

    ws.addEventListener("message", (ev) => {
      let msg;
      try { msg = JSON.parse(ev.data); } catch (_) { return; }
      if (!msg || typeof msg !== "object") return;

      if (msg.type === "jukebox_state" || msg.type === "jukebox_play") {
        HalayJukeboxAudio.sync(msg);
        return;
      }

      if (msg.type === "jukebox_searching") {
        const reqBy = sliceCodePoints(String(msg.requested_by || "DJ"), 12);
        TopDock.flashActionPill("dj", reqBy);
        StageScheduler.enqueue({
          priority: 2,
          kind: "dj_search",
          template: "micro",
          accent: "#38bdf8",
          noAvatar: true,
          htmlText: `<b>🎧 @${escHtml(reqBy)}</b> ${escHtml(sliceCodePoints(msg.query || "", 26))}...`,
          dedupKey: `djsrch:${reqBy}`,
          dedupMs: 2500,
          ttl: 2600,
        });
        return;
      }

      if (msg.type === "ai_host") {
        const lang = String(msg.lang || HudLangEngine.current);
        const flag = String(msg.flag || HudLangEngine.pack(lang).flag);
        if (msg.user?.uid || msg.user?.id) {
          HudLangEngine.onViewerLang(msg.user.uid || msg.user.id, lang, flag);
        } else if (HudLangEngine.mode === "auto") {
          HudLangEngine.switchTo(lang, false);
        }
        DjSubtitleBar.show(msg);
        if (msg.tts_url) AiHostVoicePlayer.play(msg.tts_url, lang);
        return;
      }

      if (msg.type === "director_control") {
        StageDirector.setState(msg);
        return;
      }

      if (msg.type === "stage_fx") {
        StageFxEngine.trigger(msg.fx, msg.uid, msg.nickname, msg.city, HudLangEngine.getUserLang(msg.uid));
        return;
      }

      if (msg.type === "tikoyun_settings") {
        applyTikoyunSettings(msg);
        return;
      }

      if (msg.type === "world_fx") {
        triggerWorldFx(msg.fx, msg.user);
        return;
      }

      if (msg.type === "pong") {
        return;
      }

      if (msg.type === "status") {
        if (msg.username) {
          sdkState.uniqueId = String(msg.username).replace(/^@+/, "");
          sdkState.tiktokUsername = sdkState.uniqueId;
        } else if (!msg.watching && sdkState.uniqueId && isLocalAdminHost() && ws?.readyState === WebSocket.OPEN && !sdkState._autoConnectSent) {
          sdkState._autoConnectSent = true;
          ws.send(JSON.stringify({ action: "connect_tiktok", username: sdkState.uniqueId }));
        }
        if (msg.room_id) sdkState.roomId = String(msg.room_id);
        if (msg.like_threshold) {
          likeThreshold = Math.max(1, Number(msg.like_threshold));
          TopDock.renderDeck();
        }
        if (typeof msg.total_likes === "number") TopDock.updateRoomLikes(msg.total_likes);
        TopDock.setRoundState(msg);
        if (msg.jukebox) HalayJukeboxAudio.sync(msg.jukebox);
        if (msg.director) StageDirector.setState(msg.director);
        VsArena.ingest(msg);
        if (msg.halaybasi?.nickname) {
          TopDock.topLeaderName = cleanDisplayNick(msg.halaybasi.nickname, msg.halaybasi.uid || "Lider");
        } else if (Array.isArray(msg.gift_leaderboard) && msg.gift_leaderboard[0] && Date.now() > vipLeaderLockUntil) {
          TopDock.topLeaderName = cleanDisplayNick(msg.gift_leaderboard[0].nickname, msg.gift_leaderboard[0].uid || "Lider");
        }
        MvpBoard.ingestServerData(msg);
        emit("stream_status", { event_id: nextEventId("status"), data: { status: "live" } });
        return;
      }

      if (msg.type === "reload_overlay") {
        window.location.reload();
        return;
      }

      if (msg.type === "reset_halay") {
        pendingRoleSpawns.length = 0;
        pendingSeedPayload = null;
        vipLeaderLockUntil = 0;
        joinedUsers.clear();
        userLikeTotals.clear();
        TopDock.reset();
        MvpBoard.reset();
        try { window.halay?.roles?.reset?.(); } catch (_) {}
        try {
          const line = window.halay?.line;
          if (line && Array.isArray(line.dancers)) {
            for (const d of line.dancers.slice()) {
              line.removeDancer?.(d, { walk: false });
            }
          }
        } catch (_) {}
        return;
      }

      if (msg.type === "seed_halay") {
        if (Array.isArray(msg.users)) {
          for (const rawU of msg.users) buildUser(rawU);
        }
        if (msg.user_likes && typeof msg.user_likes === "object") {
          for (const [k, v] of Object.entries(msg.user_likes)) {
            userLikeTotals.set(String(k), Math.max(userLikeTotals.get(String(k)) || 0, Number(v || 0)));
          }
        }
        TopDock.setRoundState(msg);
        MvpBoard.ingestServerData(msg);
        pendingSeedPayload = {
          users: Array.isArray(msg.users) ? msg.users : [],
          roles: (msg.roles && typeof msg.roles === "object") ? msg.roles : {}
        };
        flushSeedPayload();
        return;
      }

      if (msg.type === "round_winner") {
        TopDock.setRoundState(msg);
        VsArena.ingest(msg);
        const w = buildUser(msg.winner || { nickname: "Meydan" });
        const p = HudLangEngine.pack(HudLangEngine.current);
        const rFin = Number(msg.round_finished || 1);
        StageScheduler.enqueue({
          priority: 0, kind: "round_winner", template: "rich", accent: "#fde047",
          badge: `🏆 ${rFin}`, emblem: "🎆", user: w,
          subText: (p.roundWinSub || "🏆 {n}. Düğün Şampiyonu!").replace("{n}", String(rFin)),
          sfx: "vip", ttl: 4200
        });
        try { window.halay?.fireworks?.show?.(); window.halay?.line?.celebrateLeader?.(); } catch (_) {}
        return;
      }

      if (msg.type === "country_takeover") {
        TopDock.dominantCountry = String(msg.country || "tr");
        VsArena.ingest(msg);
        const isTr = HudLangEngine.current === "tr" || HudLangEngine.current === "az";
        const cCode = String(msg.country || "tr").toUpperCase();
        const u = buildUser(msg.user || { nickname: cCode });
        StageScheduler.enqueue({
          priority: 0, kind: "country_takeover", template: "rich", accent: "#38bdf8",
          badge: `🏴 ${cCode}`, emblem: "🌍", user: u,
          subText: isTr ? `${cCode} SAHNEYİ ELE GEÇİRDİ!` : `${cCode} TOOK OVER THE STAGE!`,
          sfx: "vip", ttl: 3600
        });
        StageFxEngine.trigger("confetti", u.nickname, 1);
        try {
          const tintMap = { tr: 0x1e1024, en: 0x0f1f3a, ar: 0x0b291e, de: 0x261d0c, ru: 0x241028, es: 0x2e170d, fr: 0x101c38, az: 0x0c2430 };
          const hex = tintMap[String(msg.country || "tr").toLowerCase()] || 0x1e1024;
          window.halay?.engine?.scene?.background?.setHex?.(hex);
        } catch (_) {}
        return;
      }

      if (msg.type === "sabotage_fx") {
        const isTr = HudLangEngine.current === "tr" || HudLangEngine.current === "az";
        const atk = buildUser(msg.attacker || { nickname: isTr ? "Oyuncu" : "Player" });
        const act = String(msg.action || "");
        if (act === "shrink_rival") {
          const vic = buildUser(msg.victim || { nickname: isTr ? "Rakip" : "Rival" });
          StageScheduler.enqueue({
            priority: 1, kind: "sabotage_fx", template: "micro", accent: "#f43f5e",
            noAvatar: true,
            htmlText: `⚡ <b>@${escHtml(sliceCodePoints(atk.nickname, 12))}</b> ▸ @${escHtml(sliceCodePoints(vic.nickname, 12))} ${isTr ? "küçüldü!" : "shrank!"}`,
            ttl: 2800
          });
          try {
            const dancers = window.halay?.line?.dancers || [];
            const durMs = Math.max(5000, Number(msg.duration || 30) * 1000);
            for (const d of dancers) {
              const did = String(d?.user?.uid || d?.uid || "");
              if (did === String(vic.id) && d?.group?.scale) {
                d.group.scale.set(0.55, 0.55, 0.55);
                setTimeout(() => { try { d.group.scale.set(1, 1, 1); } catch (_) {} }, durMs);
              } else if (did === String(atk.id) && d?.group?.scale) {
                d.group.scale.set(1.45, 1.45, 1.45);
                setTimeout(() => { try { d.group.scale.set(1, 1, 1); } catch (_) {} }, durMs);
              }
            }
          } catch (_) {}
        } else if (act === "cut_music") {
          StageScheduler.enqueue({
            priority: 1, kind: "sabotage_fx", template: "micro", accent: "#a855f7",
            noAvatar: true,
            htmlText: `🎧 <b>@${escHtml(sliceCodePoints(atk.nickname, 12))}</b> ${isTr ? "müziği değiştirdi!" : "switched the track!"}`,
            ttl: 2600
          });
        } else if (act === "boot_back" || act === "mega_shock") {
          if (Array.isArray(msg.stage_order)) applyStageOrder(msg.stage_order);
          StageFxEngine.trigger("shockwave", atk.nickname, 1);
          StageScheduler.enqueue({
            priority: 0, kind: "sabotage_fx", template: "micro", accent: "#fb923c",
            noAvatar: true,
            htmlText: `💥 <b>@${escHtml(sliceCodePoints(atk.nickname, 12))}</b> ${isTr ? "rakipleri arka sıraya attı!" : "pushed rivals back!"}`,
            ttl: 3000
          });
        }
        return;
      }

      if (msg.type === "mega_party_burst") {
        TopDock.setRoundState(msg);
        const isTr = HudLangEngine.current === "tr" || HudLangEngine.current === "az";
        const patron = buildUser(msg.patron || { nickname: isTr ? "Meydan" : "Stage" });
        StageFxEngine.trigger("disco", patron.nickname, 2);
        StageScheduler.enqueue({
          priority: 0, kind: "mega_party_burst", template: "rich", accent: "#ec4899",
          badge: isTr ? "🎉 ŞÖLEN" : "🎉 PARTY", emblem: "🪩", user: patron,
          subText: isTr
            ? `PARTİ PATRONU @${sliceCodePoints(patron.nickname, 14)} — 45sn MEGA ŞÖLEN!`
            : `PARTY BOSS @${sliceCodePoints(patron.nickname, 14)} — 45s MEGA FEAST!`,
          sfx: "vip", ttl: 4200
        });
        return;
      }

      if (msg.type === "scheduled_event") {
        const ev = msg.event || {};
        const isTr = HudLangEngine.current === "tr" || HudLangEngine.current === "az";
        if (msg.action === "start" && ev.fx) {
          const fxName = ev.fx === "war" ? "shockwave" : String(ev.fx);
          StageFxEngine.trigger(fxName, isTr ? "Meydan" : "Stage", ev.name || (isTr ? "Meydan" : "Stage"));
          StageScheduler.enqueue({
            priority: 1, kind: "scheduled_event", template: "micro", accent: "#38bdf8",
            noAvatar: true,
            htmlText: `<b>${escHtml(ev.icon || "⚡")} ${escHtml(ev.name || (isTr ? "Sahne Etkinliği" : "Stage Event"))}</b> (${Number(ev.duration || 30)}${isTr ? "sn" : "s"})`,
            dedupKey: `sched:${ev.id || "ev"}`, dedupMs: 4000, ttl: 3800
          });
        }
        return;
      }

      if (msg.type === "audience_poll") {
        const poll = msg.poll || {};
        const opts = Array.isArray(poll.options) ? poll.options : [];
        const voteStr = opts.map(o => `${escHtml(o.key)}:${Number(o.votes || 0)}`).join(" | ");
        if (msg.action === "open" || msg.action === "update") {
          const optDesc = opts.map(o => `${escHtml(o.key)}:${escHtml(o.name)}`).join(" • ");
          StageScheduler.enqueue({
            priority: 1, kind: "audience_poll", template: "micro", accent: "#fbbf24",
            noAvatar: true,
            htmlText: `🗳️ <b>!oy A/B/C</b> • ${voteStr}<br/><span>${optDesc}</span>`,
            dedupKey: "poll_live", dedupMs: 1400, ttl: 3200
          });
        } else if (msg.action === "close" && msg.winner) {
          const w = msg.winner || {};
          const isTr = HudLangEngine.current === "tr" || HudLangEngine.current === "az";
          StageScheduler.enqueue({
            priority: 1, kind: "audience_poll_end", template: "micro", accent: "#34d399",
            noAvatar: true,
            htmlText: `🏆 ${isTr ? "Anket Kazananı" : "Poll Winner"}: <b>${escHtml(w.key || "A")} — ${escHtml(w.name || "")}</b>`,
            dedupKey: "poll_end", dedupMs: 4000, ttl: 3800
          });
        }
        return;
      }

      if (msg.type === "dj_locked") {
        const u = buildUser(msg.user);
        const p = HudLangEngine.pack(msg.lang || HudLangEngine.current);
        StageScheduler.enqueue({
          priority: 2, kind: "dj_locked", template: "micro", accent: "#a855f7",
          noAvatar: true,
          htmlText: `<b>${escHtml(sliceCodePoints(u.nickname, 12))}</b> ${escHtml(p.djLockHint || "🎧 DJ kabini Parfüm (20) ve Donut (30) ile açılır!")}`,
          dedupKey: `djlock:${u.id}`, dedupMs: 5000, ttl: 2600
        });
        return;
      }

      if (msg.type === "bride_groom_locked") {
        TopDock.setRoundState(msg);
        if (MvpBoard?.podiumSlots?.[0]?.card) MvpBoard._pulseCard(MvpBoard.podiumSlots[0].card);
        if (MvpBoard?.podiumSlots?.[2]?.card) MvpBoard._pulseCard(MvpBoard.podiumSlots[2].card);
        const u = buildUser(msg.user);
        const p = HudLangEngine.pack(msg.lang || HudLangEngine.current);
        const lockTxt = String(p.bgLockHint || "👰🤵 Gelin & Damat koltuğu büyük hediye ({b}+) ile açılır!")
          .replace("{b}", String(TopDock.brideMin || 199))
          .replace("{g}", String(TopDock.groomMin || 199));
        StageScheduler.enqueue({
          priority: 1, kind: "bride_groom_locked", template: "micro", accent: "#fda4af",
          noAvatar: true,
          htmlText: `<b>${escHtml(sliceCodePoints(u.nickname, 12))}</b> ${escHtml(lockTxt)}`,
          dedupKey: `bglock:${u.id}`, dedupMs: 5000, ttl: 2800
        });
        return;
      }

      if (msg.type === "join_halay" && Array.isArray(msg.users)) {
        const validReasons = new Set(["begeni", "hediye", "stüdyo_test", "yorum", "kostum", "takip", "sira"]);
        if (msg.reason && !validReasons.has(msg.reason)) return;
        TopDock.setRoundState(msg);
        for (const rawUser of msg.users) {
          const user = buildUser(rawUser);
          const g = normalizeEngineGender(rawUser?.gender);
          if (g) user.gender = g;
          if (isUserInHalay(user.id)) continue;
          joinedUsers.add(user.id);
          if (msg.reason === "kostum" && g) {
            applyCostumeSwap(user, g);
          } else {
            enqueueRoleSpawn("katil", user, msg.reason === "hediye" ? "gift" : "like", 1);
          }
          TopDock.refreshDancerCount();
          const p = HudLangEngine.pack(HudLangEngine.current);
          StageScheduler.enqueue({
            priority: 2, kind: "join", template: "micro", accent: "#c084fc",
            user, text: p.joined, sfx: "join", dedupKey: `join:${user.id}`, ttl: 2300
          });
        }
        if (Array.isArray(msg.stage_order)) applyStageOrder(msg.stage_order);
        return;
      }

      if (msg.type === "leave_halay") {
        const luid = String(msg.uid || msg.user?.id || "");
        TopDock.setRoundState(msg);
        if (luid) {
          joinedUsers.delete(luid);
          const line = window.halay?.line;
          const victim = line?.dancers?.find?.((d) => String(d?.viewer?.id || d?.id || "") === luid);
          if (victim) {
            try { line.removeDancer?.(victim, { walk: false }); } catch (_) {}
          }
          const u = buildUser(msg.user || { uid: luid, nickname: msg.nickname || "Misafir" });
          const p = HudLangEngine.pack(HudLangEngine.current);
          const reasonTxt = msg.reason === "left_room"
            ? (p.leftRoomHint || "odadan çıktığı için halaydan ayrıldı 🚪")
            : (msg.reason === "vip_bump"
              ? (p.vipBumpHint || "yerini VIP hediye sırasına bıraktı ⚡")
              : (p.afkDropHint || "enerjisi bittiği için halaydan düştü 💤"));
          StageScheduler.enqueue({
            priority: 2, kind: "leave_halay", template: "micro", accent: "#94a3b8",
            user: u, text: reasonTxt, dedupKey: `leave:${luid}`, dedupMs: 2000, ttl: 2400
          });
        }
        TopDock.refreshDancerCount();
        return;
      }

      if (msg.type === "queue_status") {
        TopDock.setRoundState(msg);
        if (msg.user) {
          const u = buildUser(msg.user);
          const p = HudLangEngine.pack(HudLangEngine.current);
          const qPos = Number(msg.queue_pos || msg.queue_count || 1);
          const qTxt = (p.queueWaitHint || "🪑 Sahne dolu! Sıradasın (#{pos}) — Hediye ile sıra atla!")
            .replace("{pos}", String(qPos));
          StageScheduler.enqueue({
            priority: 2, kind: "queue_status", template: "micro", accent: "#fbbf24",
            user: u, text: qTxt, dedupKey: `qstat:${u.id}`, dedupMs: 4000, ttl: 2600
          });
        }
        return;
      }

      if (msg.type === "chat") {
        const user = buildUser(msg.user);
        if (msg.user?.gender) user.gender = normalizeEngineGender(msg.user.gender) || msg.user.gender;
        if (msg.lang || msg.flag) {
          HudLangEngine.onViewerLang(user.id, msg.lang || "tr", msg.flag);
        }
        TopDock.setRoundState(msg);
        if (msg.pill_trigger) {
          TopDock.flashActionPill(msg.pill_trigger, user.nickname);
        }
        VsArena.ingest(msg);
        const rawOrig = String(msg.raw_text ?? msg.text ?? "").trim();
        const safeText = msg.bubble_blocked ? "" : String(msg.text || "").trim();
        const mappedText = translateCostumeChat(safeText || rawOrig);
        const targetGender = normalizeEngineGender(msg.costume_gender) || normalizeEngineGender(mappedText);

        if (targetGender) {
          applyCostumeSwap(user, targetGender);
          const isGirl = targetGender === "kadin";
          const p = HudLangEngine.pack(HudLangEngine.getUserLang(user.id));
          StageScheduler.enqueue({
            priority: 1, kind: "costume", template: "micro", accent: isGirl ? "#f472b6" : "#38bdf8",
            user,
            text: isGirl ? (p.costumeGirlOk || "👗 Kız kostümü!") : (p.costumeBoyOk || "🕺 Efe kostümü!"),
            sfx: "join", dedupKey: `costume:${user.id}:${targetGender}`, dedupMs: 900, ttl: 2100
          });
          emit("comment", {
            event_id: nextEventId("comment"),
            data: { user, comment: { text: isGirl ? "👗" : "🕺" } }
          });
        } else if (!msg.bubble_blocked && safeText && isSafeBubbleText(mappedText)) {
          emit("comment", { event_id: nextEventId("comment"), data: { user, comment: { text: mappedText } } });
        }
        const inHalay = Boolean(msg.joined) || isUserInHalay(user.id);
        if (inHalay) joinedUsers.add(user.id);
        if (Array.isArray(msg.leaderboard)) MvpBoard.ingestServerData(msg);
        return;
      }

      if (msg.type === "like") {
        const user = buildUser(msg.user);
        VsArena.ingest(msg);
        const count = Math.max(1, Number(msg.count || 1));
        if (msg.threshold) likeThreshold = Math.max(1, Number(msg.threshold));
        const serverTotal = Number(msg.user_total || 0);
        const hadPrev = userLikeTotals.has(user.id);
        const prevTotal = hadPrev ? userLikeTotals.get(user.id) : Math.max(0, serverTotal - count);
        const newTotal = Math.max(prevTotal + count, serverTotal);
        if (userLikeTotals.size > 800 && !hadPrev) {
          const firstKey = userLikeTotals.keys().next().value;
          if (firstKey && !joinedUsers.has(firstKey)) userLikeTotals.delete(firstKey);
        }
        userLikeTotals.set(user.id, newTotal);
        try { window.halay?.roles?.active?.set?.(user.id, performance.now()); } catch (_) {}
        if (typeof msg.total_likes === "number") TopDock.updateRoomLikes(msg.total_likes);
        MvpBoard.onLike();

        const p = HudLangEngine.pack(HudLangEngine.getUserLang(user.id));

        // Always ensure >=likeThreshold viewer joins only when stage has free seats (otherwise server queue_status handles waiting queue)
        const newlyJoined = !isUserInHalay(user.id) && newTotal >= likeThreshold && (TopDock.seatCount < TopDock.maxSeats);
        if (newlyJoined) {
          joinedUsers.add(user.id);
          enqueueRoleSpawn("katil", user, "like", 1);
          TopDock.refreshDancerCount();
        }

        if (Math.floor(newTotal / 1000) > Math.floor(prevTotal / 1000)) {
          joinedUsers.add(user.id);
          try {
            triggerEngineRole("konfeti", user, "like", 1);
            window.halay?.fireworks?.show?.();
          } catch (_) {}
          StageScheduler.enqueue({
            priority: 1, kind: "milestone_1000", template: "rich", accent: "#fde047",
            badge: "⚡ 1000", emblem: "🎆", user, subText: p.leader300,
            sfx: "vip", ttl: 3200
          });
        } else if (Math.floor(newTotal / 100) > Math.floor(prevTotal / 100)) {
          joinedUsers.add(user.id);
          try {
            triggerEngineRole("konfeti", user, "like", 1);
            const nowC = Date.now();
            if (nowC - (window.__lastLikeFwMs || 0) > 4500) {
              window.__lastLikeFwMs = nowC;
              window.halay?.fireworks?.show?.();
            }
          } catch (_) {}
          StageScheduler.enqueue({
            priority: 2, kind: "milestone_100", template: "micro", accent: "#fb7185",
            user, text: p.energyBurst,
            sfx: "join", dedupKey: `m100:${user.id}`, ttl: 2400
          });
        } else if (newlyJoined) {
          StageScheduler.enqueue({
            priority: 2, kind: "join", template: "micro", accent: "#c084fc",
            user, text: p.joined, sfx: "join", dedupKey: `join:${user.id}`, ttl: 2300
          });
        } else if (!isUserInHalay(user.id) && newTotal >= 6 && newTotal < likeThreshold) {
          const rem = Math.max(1, likeThreshold - newTotal);
          StageScheduler.enqueue({
            priority: 3, kind: "like_progress", template: "micro", accent: "#38bdf8",
            user, progressUid: user.id,
            text: p.energyProg.replace("{n}", String(newTotal)).replace("{m}", String(likeThreshold)).replace("{r}", String(rem)),
            ttl: 2200
          });
        }
        return;
      }

      if (msg.type === "gift") {
        const user = buildUser(msg.user);
        VsArena.ingest(msg);
        TopDock.setRoundState(msg);
        const g = resolveGiftMeta(msg);
        MvpBoard.onGift(user, g);
        if (g.totalDiamonds < 5 && !["halaybasi", "gelin", "damat", "zurnaci", "davulcu"].includes(msg.vip_role)) {
          return;
        }
        if (!isUserInHalay(user.id)) {
          joinedUsers.add(user.id);
          enqueueRoleSpawn("katil", user, "gift", 1);
        } else {
          joinedUsers.add(user.id);
        }
        TopDock.refreshDancerCount();
        let actions = resolveGiftActions(g);
        if (msg.vip_role === "konfeti") {
          actions = ["katil", "konfeti"];
        } else if (["halaybasi", "gelin", "damat", "zurnaci", "davulcu"].includes(msg.vip_role)) {
          actions = [msg.vip_role];
          if (g.totalDiamonds >= 199) actions.push("parasac");
        } else if (msg.vip_role === "") {
          actions = g.totalDiamonds >= 5 ? ["katil", "konfeti"] : ["katil"];
        }
        const topAct = actions[actions.length - 1];

        const p = HudLangEngine.pack(HudLangEngine.getUserLang(user.id));
        const roleTuple = p.roles[topAct] || p.roles.katil;
        const roleStyle = {
          katil: { accent: "#38bdf8", sfx: "gift", emblem: "🕺" },
          konfeti: { accent: "#f472b6", sfx: "gift", emblem: "✨" },
          davulcu: { accent: "#a78bfa", sfx: "davul", emblem: "🥁" },
          halaybasi: { accent: "#fde047", sfx: "vip", emblem: "🧣" },
          zurnaci: { accent: "#38bdf8", sfx: "wedding", emblem: "🎺" },
          damat: { accent: "#fbbf24", sfx: "wedding", emblem: "🤵" },
          gelin: { accent: "#fda4af", sfx: "wedding", emblem: "👰" },
          parasac: { accent: "#34d399", sfx: "vip", emblem: "🎉" }
        }[topAct] || { accent: "#fde047", sfx: "gift", emblem: "👑" };

        for (const act of ["halaybasi", "davulcu", "zurnaci", "gelin", "damat"]) {
          if (actions.includes(act)) {
            TopDock.setRoleHolder(act, user.nickname);
            if (!MvpBoard.vipRoles || typeof MvpBoard.vipRoles !== "object") MvpBoard.vipRoles = {};
            MvpBoard.vipRoles[act] = { uid: user.id, nickname: user.nickname, avatar: user.avatar_url || "" };
          }
        }
        MvpBoard.ingestServerData({ roles: {
          halaybasi: msg.halaybasi, davulcu: msg.davulcu, zurnaci: msg.zurnaci, gelin: msg.gelin, damat: msg.damat
        }});
        if (actions.includes("halaybasi")) {
          vipLeaderLockUntil = Date.now() + 90000;
        }

        // Ignore 1-4 diamond Rose spam on screen; require >=5 single gift or >=10 cumulative Rose combo
        if (g.totalDiamonds < 5 && Number(msg.round_diamonds || 0) < 10) {
          return;
        }

        StageScheduler.enqueue({
          priority: g.totalDiamonds >= 20 ? 0 : 1,
          kind: "gift",
          template: "rich",
          accent: roleStyle.accent,
          badge: roleTuple[0],
          emblem: roleStyle.emblem,
          giftIcon: g.proxy_icon || proxyAvatar(resolveKnownGiftIcon(g.id, g.name)),
          user,
          giftName: g.name,
          comboKey: `${user.id}:${g.id}`,
          comboCount: g.repeat,
          subText: roleTuple[1],
          sfx: roleStyle.sfx,
          ttl: g.totalDiamonds >= 30 ? 3600 : 3000
        });

        const forwardedGiftId = (g.id === 5879 && actions.includes("konfeti") && !actions.includes("halaybasi")) ? 5487 : g.id;
        emit("gift", {
          event_id: nextEventId("gift"),
          data: {
            user,
            gift: { id: forwardedGiftId, name: g.name, image_url: g.image_url, diamond_unit: g.diamond_unit },
            streak: { id: nextEventId("stk"), is_final: true, event_gift_count: g.repeat, event_diamond_count: g.totalDiamonds, total_gift_count: g.repeat }
          }
        });

        const builtInMatched = new Set(
          (window.halay?.settings?.rules || [])
            .filter((r) => r.trigger === "gift" && Number(r.gift?.id) === Number(g.id))
            .map((r) => r.action)
        );
        for (const act of actions) {
          if (!builtInMatched.has(act)) triggerEngineRole(act, user, "gift", Math.max(1, Math.min(8, g.repeat)));
        }
        if (msg.special_fx) {
          StageFxEngine.trigger(msg.special_fx, user.id, user.nickname, "", HudLangEngine.getUserLang(user.id));
        }

        try {
          const canonGiftUser = buildCanonUser(user);
          if (actions.includes("parasac") && typeof window.halay?.para?.add === "function") {
            window.halay.para.add(canonGiftUser, Math.max(1, Math.min(12, g.repeat || 1)), "para");
          } else if (actions.includes("konfeti") && typeof window.halay?.para?.add === "function") {
            window.halay.para.add(canonGiftUser, Math.max(1, Math.min(8, g.repeat || 1)), "konfeti");
          }
          triggerRoleCelebration(topAct, user);
          const nowFw = Date.now();
          if ((actions.includes("parasac") || g.totalDiamonds >= 20) && nowFw - (window.__lastFwMs || 0) > 16000) {
            window.__lastFwMs = nowFw;
            window.halay?.fireworks?.show?.();
          }
          if (actions.includes("halaybasi")) window.halay?.line?.celebrateLeader?.();
          if (actions.includes("davulcu") && window.halay?.davul?.ctx) window.halay.davul.dum?.();
        } catch (_) {}
        return;
      }

      if (msg.type === "live_feed" && msg.user) {
        const user = buildUser(msg.user);
        const p = HudLangEngine.pack(HudLangEngine.getUserLang(user.id));
        if (msg.kind === "follow") {
          emit("follow", { event_id: nextEventId("follow"), data: { user } });
          StageScheduler.enqueue({ priority: 3, kind: "follow", template: "micro", accent: "#fde047", user, text: p.follow, dedupKey: `fol:${user.id}`, ttl: 2100 });
        } else if (msg.kind === "share") {
          emit("share", { event_id: nextEventId("share"), data: { user } });
          StageScheduler.enqueue({ priority: 3, kind: "share", template: "micro", accent: "#34d399", user, text: p.share, dedupKey: `shr:${user.id}`, ttl: 2100 });
        }
      }
    });

    ws.addEventListener("close", () => {
      clearInterval(wsPingTimer);
      sdkState.wsStatus = "reconnecting";
      emit("ws_close", {});
      setTimeout(connectLocalWs, 2000);
    });
  }

  window.__halayAlertStage = StageScheduler;
  window.__halayTopDock = TopDock;
  window.__halayMvpBoard = MvpBoard;

  window.TikOyun = {
    async init() {
      connectLocalWs();
      await ensureGiftCatalog();
      emit("ready", {});
      return sdkState;
    },
    async connect() {
      connectLocalWs();
      return true;
    },
    on(type, fn) {
      if (typeof fn !== "function") return () => {};
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(fn);
      return () => listeners.get(type)?.delete(fn);
    },
    off(type, fn) { listeners.get(type)?.delete(fn); },
    getState() { return { ...sdkState }; },
    disconnect() { if (ws) try { ws.close(); } catch (_) {} },
    gameSettings: {
      async get(name) {
        try {
          const r = await fetch(`/api/divalar_settings?name=${encodeURIComponent(name || "default")}`);
          if (r.ok) {
            const j = await r.json();
            if (j && j.jsonData) j.jsonData = sanitizeHalaySettings(j.jsonData);
            return j;
          }
        } catch (_) {}
        return { ok: true, exists: false, jsonData: null };
      },
      async set(name, data) {
        const cleanData = sanitizeHalaySettings(data);
        try {
          await fetch("/api/divalar_settings", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: name || "default", jsonData: cleanData })
          });
        } catch (_) {}
        return { ok: true };
      },
      async getPublic() { return { ok: true, exists: false, jsonData: null }; }
    },
    util: {
      normalizeUniqueId(v) { return String(v || "").trim().replace(/^@+/, "").toLowerCase(); }
    },
    security: {
      escapeHtml: escHtml,
      sanitizePlainText(s, opts) {
        const max = (opts && opts.maxLength) || 150;
        return String(s ?? "").replace(/[\u0000-\u001F\u007F]/g, " ").trim().slice(0, max);
      },
      sanitizeUrl(u) {
        const s = String(u ?? "").trim();
        return (/^(https?:\/\/|\/)/i.test(s)) ? s : "";
      },
      sanitizeCssColor(c, fb) { return String(c || fb || "#ffffff"); },
      sanitizeBinarySwitch(v, fb) { return typeof v === "boolean" ? v : !!fb; }
    },
    profile: {
      async fetch(uniqueId) {
        const clean = String(uniqueId || sdkState.uniqueId || "mert.can.yldz2").replace(/^@+/, "");
        return { id: clean, secUid: clean, username: clean, nickname: clean, avatar: { small: null, medium: null, large: null } };
      },
      async fetchFast(id, secUid) {
        return { id: String(id || ""), secUid: String(secUid || ""), avatar: { small: null } };
      }
    },
    gifts: {
      async fetch() { return await ensureGiftCatalog(); }
    },
    setTikTokUser(handle) {
      const clean = String(handle || "").replace(/^@+/, "").trim();
      if (!clean) return;
      sdkState.uniqueId = clean;
      sdkState.tiktokUsername = clean;
      try { localStorage.setItem("divalar:tiktok_user", clean); } catch (_) {}
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ action: "connect_tiktok", username: clean }));
      }
    }
  };
})();

// Minimal Modern TikTok Room Switcher & Alert System Controls inside ESC -> Canlı yayın
(function () {
  const obs = new MutationObserver(() => {
    const body = document.querySelector(".ay-body");
    if (!body) return;
    const statusBox = body.querySelector(".ay-status");
    if (!statusBox || body.querySelector("#local-tiktok-switcher")) return;

    const wrap = document.createElement("div");
    wrap.id = "local-tiktok-switcher";
    wrap.style.cssText = "display:grid;gap:6px;margin:6px 0 12px 0;";
    const cur = window.TikOyun?.getState?.()?.uniqueId || "mert.can.yldz2";
    const escAttr = (v) => String(v ?? "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[m]));
    wrap.innerHTML = `
      <div style="display:flex;gap:6px;align-items:center;">
        <input id="local-tt-inp" type="text" value="@${escAttr(cur)}" placeholder="@kullanici_adi"
          style="flex:1;min-width:0;padding:4px 9px;border-radius:7px;border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.05);color:#fff;font-size:11.5px;" />
        <button id="local-tt-btn" type="button" class="ay-btn primary" style="padding:4px 10px;">Bağlan</button>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:5px;align-items:center;">
        <button id="local-gfx-btn" type="button" class="ay-btn soft">✨ ${window.__halayGfx?.getLabel?.() || "60 FPS Keskin HD"}</button>
        <button id="local-test-alert" type="button" class="ay-btn try">⚡ Meydan Alert Test</button>
        <button id="local-ai-panel-btn" type="button" class="ay-btn soft">🤖 AI Panel</button>
      </div>
    `;
    statusBox.insertAdjacentElement("afterend", wrap);

    const inp = wrap.querySelector("#local-tt-inp");
    const btn = wrap.querySelector("#local-tt-btn");
    const gfxBtn = wrap.querySelector("#local-gfx-btn");
    const testBtn = wrap.querySelector("#local-test-alert");
    const aiPanelBtn = wrap.querySelector("#local-ai-panel-btn");

    aiPanelBtn?.addEventListener("click", () => {
      window.open("/ai-panel", "_blank", "noopener,noreferrer");
    });

    gfxBtn?.addEventListener("click", () => {
      if (!window.__halayGfx) return;
      const lbl = window.__halayGfx.cycleMode();
      gfxBtn.textContent = `✨ ${lbl}`;
    });

    const submit = () => {
      const val = inp.value.replace(/^@+/, "").trim();
      if (!val) return;
      window.TikOyun.setTikTokUser(val);
      btn.textContent = "Bağlandı ✓";
      setTimeout(() => { btn.textContent = "Bağlan"; }, 1400);
    };
    btn.addEventListener("click", submit);
    inp.addEventListener("keydown", (e) => { if (e.key === "Enter") submit(); });
    testBtn?.addEventListener("click", () => {
      stage?.enqueue({
        priority: 0, kind: "gift", template: "rich", accent: "#fde047", badge: "HALAYBAŞI",
        user: { id: "test_vip", nickname: "Diva Konuk" },
        comboKey: "test_vip:5879", comboCount: 3,
        subText: "Halaybaşı Mendilini Aldı! 🧣", sfx: "vip", ttl: 3400
      });
    });
  });
  if (document.documentElement) obs.observe(document.documentElement, { childList: true, subtree: true });
})();
