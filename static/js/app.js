import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { HalayAudioEngine } from "./audio_engine.js?v=99";
import { buildWeddingWorld } from "./world_builder.js?v=99";
import { HalayController } from "./halay_controller.js?v=100";
import { generateAvatarDataUrl } from "./roach_factory.js?v=99";
import { CommercialHudController } from "./hud_overlay.js?v=99";

const params = new URLSearchParams(window.location.search);
const isStandalone =
  window.navigator.standalone === true ||
  window.matchMedia?.("(display-mode: standalone)")?.matches === true;
const isTikTok800x600 =
  Math.abs(window.innerWidth - 800) <= 24 && Math.abs(window.innerHeight - 600) <= 24;
const isOverlayMode =
  params.get("obs") === "1" ||
  window.location.pathname === "/overlay" ||
  isStandalone ||
  isTikTok800x600;

if (isOverlayMode && params.get("studio") !== "1") {
  document.body.classList.add("obs-mode");
}
if (isTikTok800x600 || params.get("stretch") === "1") {
  document.body.classList.add("anamorphic-916");
}

const drawer = document.getElementById("control-drawer");
if (document.documentElement.classList.contains("init-drawer-closed")) {
  drawer?.classList.add("hidden");
  document.documentElement.classList.remove("init-drawer-closed");
} else if (isOverlayMode && params.get("studio") !== "1" && drawer) {
  drawer.classList.add("hidden");
}

const stageFrame = document.getElementById("stage-frame");
const canvas = document.getElementById("webgl-canvas");
const labelsLayer = document.getElementById("labels-layer");
const hudLayer = document.getElementById("hud-layer");
const topBanner = document.getElementById("top-cta-banner");
const joinToast = document.getElementById("join-toast");
const joinAvatars = document.getElementById("join-avatars");
const joinMessage = document.getElementById("join-message");
const giftAlert = document.getElementById("gift-alert");
const giftAlertIcon = document.getElementById("gift-alert-icon");
const giftAlertText = document.getElementById("gift-alert-text");
const liveFeedBox = document.getElementById("live-feed-box");
const mobileTapHint = document.getElementById("mobile-tap-hint");

if (params.get("clean") === "1" && hudLayer) {
  hudLayer.classList.add("hidden");
}

const isMobileGpu = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent || "") || window.innerWidth <= 768;
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: false, // 60 FPS locked for OBS & TikTok LIVE Studio CEF
  powerPreference: "high-performance",
  preserveDrawingBuffer: false,
  precision: "mediump", // Fast shader arithmetic for GPU encoding headroom
});
renderer.setPixelRatio(1.0); // Exact 1:1 pixel mapping (1080x1920) without laggy over-rendering
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.BasicShadowMap; // Ultra-fast single pass shadows (zero stutter)
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
window.renderer = renderer;
canvas.addEventListener("webglcontextlost", (e) => {
  e.preventDefault();
}, false);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(44, 9 / 16, 0.1, 150);
camera.position.set(0, 10.6, 17.6);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.target.set(0, 1.15, -2.3);
controls.maxPolarAngle = Math.PI * 0.47;
controls.minDistance = 5;
controls.maxDistance = 38;

const worldFX = buildWeddingWorld(scene);
const audio = new HalayAudioEngine();
const halay = new HalayController(scene, labelsLayer, worldFX);
const hud = new CommercialHudController(stageFrame);

window.halay = halay;
window.worldFX = worldFX;
window.audioEngine = audio;
window.hud = hud;
window.camera = camera;
window.scene = scene;
window.THREE = THREE;

halay.onGiftPinned = ({ dancer, role, type, coins }) => {
  const isBride = role === "gelin";
  const itemLabel = type === "cash" ? "100 Dolar 💵" : "Çeyrek Altın 🪙";
  const title = isBride ? "👰 GELİNE TAKI TAKILDI! 🪙" : "🤵 DAMADA TAKI TAKILDI! 💵";
  const sub = `<b>${escapeHtml(dancer.nickname)}</b> ${isBride ? "geline" : "damada"} ${itemLabel} taktı!`;
  showGiftAlert(title, sub);
  pushRightToast(type === "cash" ? "💵" : "🪙", dancer.nickname, `${isBride ? "Geline" : "Damada"} ${itemLabel} taktı!`, true);
  audio.playCoinChime();
};

halay.onNewDancerJoined = (dancer) => {
  showWelcomeAlert(dancer.nickname);
  pushRightToast("👋", dancer.nickname, "Halaya katıldı!", false);
};

function resizeStage() {
  const isAnamorphic =
    (Math.abs(window.innerWidth - 800) <= 24 && Math.abs(window.innerHeight - 600) <= 24) ||
    params.get("stretch") === "1";
  document.body.classList.toggle("anamorphic-916", isAnamorphic);

  const isObs = params.get("obs") === "1" || location.pathname === "/overlay";
  const isPortraitScreen = window.innerWidth <= 768 || window.innerWidth < window.innerHeight;
  const isFullBleed = isAnamorphic || isObs || isPortraitScreen;
  const w = (isFullBleed ? window.innerWidth : stageFrame.clientWidth) || 1080;
  const h = (isFullBleed ? window.innerHeight : stageFrame.clientHeight) || 1920;
  const aspect = isAnamorphic ? (9 / 16) : (w / Math.max(1, h));
  camera.aspect = aspect;
  camera.fov = aspect < 0.54 ? Math.min(52, 44 * (0.54 / aspect) * 0.94) : 44;
  camera.updateProjectionMatrix();

  // 60 FPS locked for OBS & TikTok LIVE Studio CEF:
  // Render exact 1:1 pixel mapping (1080x1920) without laggy over-sampling
  renderer.setPixelRatio(1.0);
  renderer.setSize(w, h, false);
}
window.addEventListener("resize", () => {
  const tag = document.activeElement?.tagName;
  if (drawer && !drawer.classList.contains("hidden") && (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA")) {
    return;
  }
  resizeStage();
});
window.visualViewport?.addEventListener("resize", () => {
  if (drawer && !drawer.classList.contains("hidden")) return;
  resizeStage();
});
resizeStage();

const GOAL_STEPS = [15, 30, 50, 75, 100, 150];
let goalStepIdx = 0;
let goalTarget = GOAL_STEPS[0];
let goalsHit = 0;
let heat = 0.24;
let comboCount = 0;
let comboDecayTimer = 0;
let teamScores = { gelin: 0, damat: 0 };

let cameraMode = "director";
let runnerFocusHold = 0;
let liveViewers = 0;
let liveLikes = 0;
let liveComments = 0;
let currentBossName = "";
let currentLeaderboard = [];
// Livedeck halay-kreise.webp & TİLKİ 🦊 Signature Camera: Frames full 360° Halay Circle + Bride/Groom Spotlight + Trees
const camTargetPos = new THREE.Vector3(0, 8.8, 15.6);
const camLookAtPos = new THREE.Vector3(0, 1.15, -1.1);

let stageUiWakeTimer = null;
function wakeStageControls(durationMs = 4500) {
  if (!stageFrame) return;
  stageFrame.classList.add("ui-awake");
  if (stageUiWakeTimer) clearTimeout(stageUiWakeTimer);
  stageUiWakeTimer = setTimeout(() => {
    const drawerOpen = drawer ? !drawer.classList.contains("hidden") : false;
    if (!drawerOpen) stageFrame.classList.remove("ui-awake");
  }, durationMs);
}
wakeStageControls(3200);
if (stageFrame) {
  ["pointerdown", "touchstart", "mousemove"].forEach((evName) => {
    stageFrame.addEventListener(evName, () => wakeStageControls(4500), { passive: true });
  });
}

// 100-Track YouTube Halay Jukebox Frontend State
let jukeboxTracks = [];
let jukeboxCategory = "all";
let jukeboxSearch = "";
let jukeboxShuffle = false;
let currentRequestedBy = "";

function escapeHtml(str) {
  return String(str || "").replace(/[&<>"']/g, (m) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[m]));
}

function normTr(str) {
  return String(str || "")
    .replace(/[ıİ]/g, "i").replace(/[ğĞ]/g, "g").replace(/[üÜ]/g, "u")
    .replace(/[şŞ]/g, "s").replace(/[öÖ]/g, "o").replace(/[çÇ]/g, "c")
    .toLowerCase().trim();
}

function fmtTime(sec) {
  const s = Math.max(0, Math.floor(sec || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

// Unlock button for iOS Safari / Mobile Autoplay Policy
if (mobileTapHint) {
  const onTapUnlock = async (ev) => {
    ev.stopPropagation();
    await audio.unlockAndPlayNow();
    navigator.wakeLock?.request?.("screen").catch(() => {});
    setTimeout(resizeStage, 80);
  };
  mobileTapHint.addEventListener("click", onTapUnlock);
  mobileTapHint.addEventListener("touchend", onTapUnlock);
}

audio.onStateChange = (st) => {
  const btnAudio = document.getElementById("btn-audio");
  if (btnAudio) {
    if (st.isLoading) btnAudio.textContent = "⏳ Parça Hazırlanıyor...";
    else if (st.isPlaying) btnAudio.textContent = "⏸️ Çalıyor (Duraklat)";
    else btnAudio.textContent = "▶️ Müziği Başlat";
  }
  if (mobileTapHint) {
    mobileTapHint.classList.toggle("hidden", !st.needsUnlock);
  }
  const tr = st.track;
  if (tr) {
    const jbTitle = document.getElementById("jb-now-title");
    const jbSub = document.getElementById("jb-now-sub");
    const jbBadge = document.getElementById("jb-now-badge");
    if (jbTitle) jbTitle.textContent = `#${tr.index} • ${tr.title}`;
    if (jbSub) jbSub.textContent = `${tr.channel || "Halay Meydanı"} • ${tr.category_label || ""}`;
    if (jbBadge) {
      jbBadge.textContent = currentRequestedBy
        ? `🎧 DJ İSTEK: ${currentRequestedBy.toUpperCase()}`
        : (st.sourceMode === "custom" ? "📂 ÖZEL MP3 AKTİF" : "KESİNTİSİZ 100 HALAY RADYOSU");
    }
  }
  const miniPlayBtn = document.getElementById("mini-btn-play");
  if (miniPlayBtn) {
    miniPlayBtn.textContent = st.isLoading ? "⏳" : (st.isPlaying ? "🔊" : "🔇");
  }
  hud.updateNowPlaying(tr, st.isPlaying, st.isLoading, audio.getSpectrumBars(4), currentRequestedBy);
  renderPlaylistRows();
};

audio.onTrackEnded = () => {
  if (ws && ws.readyState === WebSocket.OPEN) {
    sendCmd({ action: "jukebox_next" });
  } else if (jukeboxTracks.length > 0) {
    const curIdx = jukeboxTracks.findIndex((t) => t.id === audio.currentTrack?.id);
    const nxt = jukeboxTracks[(curIdx + 1) % jukeboxTracks.length];
    if (nxt) audio.playYouTubeTrack(nxt, true);
  }
};

async function loadJukeboxCatalog() {
  try {
    const r = await fetch("/api/jukebox/catalog");
    if (!r.ok) return;
    const data = await r.json();
    jukeboxTracks = data.tracks || [];
    jukeboxShuffle = !!data.shuffle;
    jukeboxCategory = data.active_category || "all";
    updateCacheBadge(data.cached_count || 0, jukeboxTracks.length);
    syncJukeboxControlsUI();
    renderPlaylistRows();
    if (data.current && (!audio.currentTrack || audio.currentTrack.id !== data.current.id)) {
      await audio.playYouTubeTrack(data.current, true);
    }
  } catch (err) {
    console.warn("[Jukebox] Catalog load failed:", err);
  }
}

function updateCacheBadge(cachedCount, totalCount) {
  const el = document.getElementById("ecc-cache-stat");
  if (el) el.textContent = `⚡ Önbellek: ${cachedCount}/${totalCount || 100}`;
  const pill = document.getElementById("tab-jb-badge");
  if (pill) pill.textContent = String(totalCount || 100);
}

function syncJukeboxControlsUI() {
  const shufBtn = document.getElementById("btn-jb-shuffle");
  if (shufBtn) shufBtn.classList.toggle("shuffle-on", jukeboxShuffle);
  document.querySelectorAll("#jb-cat-chips .chip").forEach((ch) => {
    ch.classList.toggle("active", ch.dataset.cat === jukeboxCategory);
  });
}

function renderDjQueue(queue = []) {
  const box = document.getElementById("jb-dj-queue-box");
  if (!box) return;
  if (!queue.length) {
    box.classList.add("hidden");
    return;
  }
  box.classList.remove("hidden");
  box.innerHTML = `<b>🎧 İzleyici DJ Sırası (${queue.length}):</b> ` +
    queue.map((q) => `<span>#${q.index} ${escapeHtml(q.title.slice(0, 24))} <i>(@${escapeHtml(q.requested_by)})</i></span>`).join(" • ");
}

function renderPlaylistRows() {
  const listEl = document.getElementById("jb-track-list");
  if (!listEl) return;
  const q = normTr(jukeboxSearch);
  const filtered = jukeboxTracks.filter((tr) => {
    if (jukeboxCategory !== "all" && tr.category !== jukeboxCategory) return false;
    if (!q) return true;
    const hay = normTr(`${tr.index} ${tr.title} ${tr.channel} ${tr.category_label}`);
    return hay.includes(q);
  });

  if (!filtered.length) {
    listEl.dataset.renderSig = "";
    listEl.innerHTML = `<div class="feed-empty">Aramaya uygun halay bulunamadı.</div>`;
    return;
  }

  const activeId = audio.currentTrack?.id || "";
  const sig = filtered.map((tr) => tr.id).join(",");
  if (listEl.dataset.renderSig === sig && listEl.children.length === filtered.length) {
    for (let i = 0; i < filtered.length; i++) {
      const tr = filtered[i];
      const row = listEl.children[i];
      if (!row) continue;
      row.classList.toggle("active", tr.id === activeId);
      const tagEl = row.querySelector(".jb-tag");
      if (tagEl) {
        tagEl.className = `jb-tag ${tr.cached ? "ready" : "cloud"}`;
        tagEl.textContent = tr.cached ? "⚡ Hazır" : fmtTime(tr.duration);
      }
    }
    return;
  }

  listEl.dataset.renderSig = sig;
  listEl.innerHTML = filtered.map((tr) => {
    const isAct = tr.id === activeId;
    const tagCls = tr.cached ? "ready" : "cloud";
    const tagTxt = tr.cached ? "⚡ Hazır" : fmtTime(tr.duration);
    return `
      <div class="jb-row${isAct ? " active" : ""}" data-vid="${escapeHtml(tr.id)}">
        <span class="jb-num">#${tr.index}</span>
        <div class="jb-info">
          <div class="jb-title">${escapeHtml(tr.title)}</div>
          <div class="jb-sub">${escapeHtml(tr.category_label || "")} • ${escapeHtml(tr.channel || "")}</div>
        </div>
        <span class="jb-tag ${tagCls}">${tagTxt}</span>
      </div>
    `;
  }).join("");
}

document.getElementById("jb-track-list")?.addEventListener("click", (e) => {
  const row = e.target.closest(".jb-row");
  if (!row) return;
  const vid = row.dataset.vid;
  if (!vid) return;
  audio.desiredPlaying = true;
  sendCmd({ action: "jukebox_select", id: vid, by: "" });
  const local = jukeboxTracks.find((t) => t.id === vid);
  if (local) {
    currentRequestedBy = "";
    audio.playYouTubeTrack(local, true);
  }
});

function checkHalayGoalMilestones(announce = true) {
  const count = halay.starterCrowdEnabled ? halay.dancers.length : halay.getRealDancerCount();
  while (count >= goalTarget) {
    const reached = goalTarget;
    goalsHit++;
    goalStepIdx = Math.min(GOAL_STEPS.length - 1, goalStepIdx + 1);
    goalTarget = goalStepIdx < GOAL_STEPS.length - 1 ? GOAL_STEPS[goalStepIdx] : goalTarget + 50;
    if (announce) {
      worldFX.spawnCelebration(new THREE.Vector3(0, 2.0, -0.5), 95, true);
      audio.playWinFanfare();
      hud.showPopBanner(`🏆 ${reached} KİŞİLİK HALAY!`, `Yeni Hedef: ${goalTarget} Katılımcı`, "#4ade80");
      audio.speak(`Helal olsun! ${reached} kişilik halay hedefi aşıldı!`);
    }
  }
}

let toastTimer = null;
function showJoinToast(users) {
  if (!joinToast || !joinAvatars || !joinMessage || !users?.length) return;
  joinAvatars.innerHTML = "";
  const u = users[users.length - 1];
  const img = document.createElement("img");
  img.referrerPolicy = "no-referrer";
  img.decoding = "async";
  const fb = generateAvatarDataUrl(u.nickname || "M");
  img.src = u.avatar || fb;
  img.onerror = () => {
    if (u.proxy_avatar && img.src !== location.origin + u.proxy_avatar) {
      img.src = u.proxy_avatar;
    } else {
      img.src = fb;
    }
  };
  joinAvatars.appendChild(img);

  joinMessage.innerHTML = `<span class="gold-name">${escapeHtml(u.nickname)}</span> halaya katıldı`;

  joinToast.classList.remove("hidden");
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => joinToast.classList.add("hidden"), 3800);
}

let giftTimer = null;
function showGiftAlert(topHtml, subHtml) {
  if (!giftAlert || !giftAlertIcon || !giftAlertText) return;
  giftAlertIcon.innerHTML = topHtml;
  giftAlertText.innerHTML = subHtml;
  giftAlert.classList.remove("hidden");
  if (giftTimer) clearTimeout(giftTimer);
  giftTimer = setTimeout(() => giftAlert.classList.add("hidden"), 4400);
}

let welcomeTimer = null;
function showWelcomeAlert(nick) {
  const card = document.getElementById("welcome-alert");
  const nickEl = document.getElementById("bwc-nick");
  if (!card || !nickEl) return;
  nickEl.textContent = `${nick || "Misafir"} Halaya Katıldı!`;
  card.classList.remove("hidden");
  if (welcomeTimer) clearTimeout(welcomeTimer);
  welcomeTimer = setTimeout(() => card.classList.add("hidden"), 3400);
}

// Tris: Etkileşimde bulunan (beğenen, yorum atan, katılan) izleyiciyi 1 sn gösterip Gelin & Damat'a dön
let interactionFocusTimer = 0;
let interactionFocusDancer = null;
function triggerInteractionFocus(user, durationSec = 1.0) {
  if (!user || !user.uid) return;
  const target = halay.dancerMap.get(user.uid) || halay.spectatorMap.get(user.uid);
  if (!target) return;
  interactionFocusDancer = target;
  interactionFocusTimer = durationSec;
}

function pushRightToast(icon, nick, action, isGold = false) {
  const box = document.getElementById("bocek-right-toasts");
  if (!box) return;
  const bar = document.createElement("div");
  bar.className = `brt-bar${isGold ? " gold" : ""}`;
  bar.innerHTML = `<span>${icon}</span> <span class="brt-nick">${escapeHtml(String(nick || "Misafir").slice(0, 14))}</span> <span class="brt-act">${escapeHtml(String(action || ""))}</span>`;
  box.prepend(bar);
  while (box.children.length > 3) {
    box.removeChild(box.lastChild);
  }
}

function appendLiveFeed(kind, user, detail) {
  const iconMap = { enter: "👋", like: "❤️", chat: "💬", gift: "🎁", follow: "➕", share: "🔄", dj: "🎧", join: "💃" };
  if (kind === "join" || kind === "gift" || kind === "dj") {
    pushRightToast(iconMap[kind] || "💃", user?.nickname || "Misafir", detail, kind === "gift");
  }

  if (!liveFeedBox) return;
  const empty = liveFeedBox.querySelector(".feed-empty");
  if (empty) empty.remove();

  const row = document.createElement("div");
  row.className = "feed-item";
  const img = document.createElement("img");
  img.referrerPolicy = "no-referrer";
  img.decoding = "async";
  const fb = generateAvatarDataUrl(user?.nickname || "M");
  img.src = user?.avatar || fb;
  img.onerror = () => {
    if (user?.proxy_avatar && !img.dataset.triedProxy) {
      img.dataset.triedProxy = "1";
      img.src = user.proxy_avatar;
    } else {
      img.src = fb;
    }
  };

  const textSpan = document.createElement("span");
  textSpan.innerHTML = `${iconMap[kind] || "⚡"} <b>${escapeHtml(user?.nickname || "İzleyici")}</b>: ${escapeHtml(detail)}`;
  row.append(img, textSpan);
  liveFeedBox.prepend(row);
  while (liveFeedBox.children.length > 45) {
    liveFeedBox.removeChild(liveFeedBox.lastChild);
  }
}

function renderRightDashboardLeaders(list = []) {
  currentLeaderboard = Array.isArray(list) ? list : [];
  const box = document.getElementById("dash-leaders-list");
  if (!box) return;
  if (!currentLeaderboard.length) {
    box.innerHTML = `
      <div class="bll-row"><span class="bll-rank r1">1</span><span class="bll-name">-</span><span class="bll-score">🪙 <b>0</b></span></div>
      <div class="bll-row"><span class="bll-rank r2">2</span><span class="bll-name">-</span><span class="bll-score">🪙 <b>0</b></span></div>
      <div class="bll-row"><span class="bll-rank r3">3</span><span class="bll-name">-</span><span class="bll-score">🪙 <b>0</b></span></div>
    `;
    return;
  }
  box.innerHTML = currentLeaderboard.slice(0, 5).map((item, idx) => {
    const rankNum = idx + 1;
    const rCls = rankNum <= 3 ? ` r${rankNum}` : "";
    const coinVal = item.coins ?? item.score ?? 0;
    return `
      <div class="bll-row">
        <span class="bll-rank${rCls}">${rankNum}</span>
        <span class="bll-name">${escapeHtml((item.nickname || "Misafir").slice(0, 11))}</span>
        <span class="bll-score">🪙 <b>${coinVal}</b></span>
      </div>
    `;
  }).join("");
}

const TURKISH_CITIES_MAP = {
  "01": "Adana", "adana": "Adana",
  "02": "Adıyaman", "adiyaman": "Adıyaman",
  "06": "Ankara", "ankara": "Ankara",
  "07": "Antalya", "antalya": "Antalya",
  "16": "Bursa", "bursa": "Bursa",
  "21": "Diyarbakır", "diyarbakir": "Diyarbakır", "amed": "Diyarbakır",
  "23": "Elazığ", "elazig": "Elazığ",
  "25": "Erzurum", "erzurum": "Erzurum", "dadas": "Erzurum",
  "27": "Gaziantep", "gaziantep": "Gaziantep", "antep": "Gaziantep",
  "31": "Hatay", "hatay": "Hatay",
  "34": "İstanbul", "istanbul": "İstanbul",
  "35": "İzmir", "izmir": "İzmir",
  "38": "Kayseri", "kayseri": "Kayseri",
  "42": "Konya", "konya": "Konya",
  "44": "Malatya", "malatya": "Malatya",
  "46": "Maraş", "maras": "Maraş", "kahramanmaras": "Maraş",
  "55": "Samsun", "samsun": "Samsun",
  "58": "Sivas", "sivas": "Sivas", "yigido": "Sivas",
  "61": "Trabzon", "trabzon": "Trabzon",
  "62": "Tunceli", "tunceli": "Tunceli", "dersim": "Tunceli",
  "63": "Şanlıurfa", "sanliurfa": "Şanlıurfa", "urfa": "Şanlıurfa",
  "65": "Van", "van": "Van",
  "72": "Batman", "batman": "Batman",
  "73": "Şırnak", "sirnak": "Şırnak"
};

const cityVoteMap = new Map([
  ["Şanlıurfa", 14],
  ["Diyarbakır", 12],
  ["Adana", 10],
  ["Trabzon", 8],
  ["İstanbul", 6],
]);

function parseCityFromChat(text) {
  if (!text) return null;
  const clean = text.trim().toLowerCase().replace(/[^a-z0-9ğüşıöç]/g, "");
  if (TURKISH_CITIES_MAP[clean]) return TURKISH_CITIES_MAP[clean];
  const words = text.toLowerCase().split(/\s+/);
  for (const w of words) {
    const cw = w.replace(/[^a-z0-9ğüşıöç]/g, "");
    if (TURKISH_CITIES_MAP[cw]) return TURKISH_CITIES_MAP[cw];
  }
  return null;
}

function updateCityBattleUI() {
  const listEl = document.getElementById("hcb-list");
  if (!listEl) return;
  const sorted = Array.from(cityVoteMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 4);
  listEl.innerHTML = sorted.map(([cityName, count], idx) => `
    <div class="hcb-row">
      <span class="hcb-rank">${idx + 1}</span>
      <span class="hcb-city">${cityName}</span>
      <span class="hcb-score">${count}</span>
    </div>
  `).join("");
  const card = document.getElementById("hud-city-battle");
  if (card) {
    card.classList.remove("bump");
    void card.offsetWidth;
    card.classList.add("bump");
  }
}

function recordCityVote(cityName) {
  cityVoteMap.set(cityName, (cityVoteMap.get(cityName) || 0) + 1);
  updateCityBattleUI();
  hud.showPopBanner(`🇹🇷 ${cityName} +1 Oy!`, "Memleket kapışmasında yükseliyor!", "#fbbf24");
  if (Math.random() < 0.35) {
    speakCachedAnnouncer(`${cityName} atağa geçti, haydi memleketliler!`);
  }
}

function renderRightDashboardCities(list = []) {
  if (Array.isArray(list) && list.length > 0) {
    list.forEach((item) => {
      if (item && item.city) cityVoteMap.set(item.city, item.count || 1);
    });
    updateCityBattleUI();
  }
}

let chestCoins = 15;
let chestGoal = 100;
function updateChestBarUI() {
  const f = document.getElementById("bar-chest-fill");
  const t = document.getElementById("bar-chest-txt");
  const pct = Math.min(100, Math.round((chestCoins / chestGoal) * 100));
  if (f) f.style.width = `${pct}%`;
  if (t) t.textContent = `${chestCoins} / ${chestGoal} 🪙 · Kalan: ${Math.max(0, chestGoal - chestCoins)}`;
}

function recordChestGift(dm, user) {
  chestCoins += dm;
  updateChestBarUI();
  if (chestCoins >= chestGoal) {
    chestCoins = chestCoins % chestGoal;
    chestGoal = Math.min(500, chestGoal + 50);
    worldFX.spawnFireworks(0, -12);
    worldFX.spawnMoneyRain(150);
    audio.playWinFanfare();
    speakCachedAnnouncer("Takı sandığı doldu taştı! Yeni halay parçası başlıyor!");
    sendCmd({ action: "jukebox_next" });
  }
}

window.recordChestGift = recordChestGift;
window.recordCityVote = recordCityVote;

let lastWobbleTs = 0;
function maybeTriggerWobble(bpm) {
  const now = Date.now();
  if (bpm >= 135 && now - lastWobbleTs > 45000) {
    lastWobbleTs = now;
    halay.triggerWobble();
    audio.playClapBurst(8);
    hud.showPopBanner("😂 HALAY KARIŞTI!", "Aşırı hızdan sendeleyenler var!", "#f43f5e");
    speakCachedAnnouncer("Aman dikkat, halay hızlandı, toparlanın dostlar!");
  }
}

let currentDavulcuObj = null;
let currentZurnaciObj = null;
let currentGelinObj = null;
let currentDamatObj = null;
let currentTempoGear = "orta";
let lastSpokenPhrase = "";
let lastSpokenTs = 0;

function speakCachedAnnouncer(text) {
  if (!text || !audio.ttsEnabled) return;
  const now = Date.now();
  if (text === lastSpokenPhrase && now - lastSpokenTs < 12000) return;
  lastSpokenPhrase = text;
  lastSpokenTs = now;
  audio.speak(text);
}

function updateRightDashboardBoss(bossObj, davulcuObj = undefined, zurnaciObj = undefined, gelinObj = undefined, damatObj = undefined) {
  if (bossObj !== undefined) {
    currentBossName = bossObj?.nickname || "";
    const elHb = document.getElementById("role-sub-halaybasi");
    if (elHb) elHb.textContent = currentBossName || "en çok atan";
  }
  if (davulcuObj !== undefined) {
    currentDavulcuObj = davulcuObj;
    halay.assignMusicianRole("davulcu", davulcuObj);
    const elDv = document.getElementById("role-sub-davulcu");
    if (elDv) elDv.textContent = davulcuObj?.nickname || "-";
  }
  if (zurnaciObj !== undefined) {
    currentZurnaciObj = zurnaciObj;
    halay.assignMusicianRole("zurnaci", zurnaciObj);
    const elZr = document.getElementById("role-sub-zurnaci");
    if (elZr) elZr.textContent = zurnaciObj?.nickname || "-";
  }
  if (gelinObj !== undefined) {
    currentGelinObj = gelinObj;
    halay.assignCoupleRole("gelin", gelinObj, gelinObj?.coins || 99);
    const elGl = document.getElementById("role-sub-gelin");
    if (elGl) elGl.textContent = gelinObj?.nickname || "-";
  }
  if (damatObj !== undefined) {
    currentDamatObj = damatObj;
    halay.assignCoupleRole("damat", damatObj, damatObj?.coins || 99);
    const elDm = document.getElementById("role-sub-damat");
    if (elDm) elDm.textContent = damatObj?.nickname || "-";
  }
}

function getTempoGearBadge() {
  if (currentTempoGear === "cosku") return "🚀 COŞKU 1.5X";
  if (currentTempoGear === "hizli") return "⚡ HIZLI 1.25X";
  if (currentTempoGear === "yavas") return "🐢 AĞIR 0.85X";
  return "🔥 DÜĞÜN COŞKUSU";
}

function updateStatsUI() {
  const activeCount = halay.starterCrowdEnabled ? halay.dancers.length : halay.getRealDancerCount();
  const viewerTxt = liveViewers > 0 ? ` • 👁️ ${liveViewers}` : "";
  const statEl = document.getElementById("stat-dancers");
  if (statEl) statEl.textContent = `${activeCount} Katılımcı${viewerTxt}`;

  const dViewers = document.getElementById("dash-viewers");
  const dLikes = document.getElementById("dash-likes");
  const dComments = document.getElementById("dash-comments");
  const dDancers = document.getElementById("dash-dancers");
  if (dViewers) dViewers.textContent = liveViewers.toLocaleString("tr-TR");
  if (dLikes) dLikes.textContent = liveLikes.toLocaleString("tr-TR");
  if (dComments) dComments.textContent = liveComments.toLocaleString("tr-TR");
  if (dDancers) dDancers.textContent = String(activeCount);

  const ldMoodFill = document.getElementById("livedeck-mood-fill");
  const ldMoodLbl = document.getElementById("livedeck-mood-label");
  const moodPct = Math.min(100, Math.max(24, Math.round(heat * 100 + activeCount * 4)));
  if (ldMoodFill) ldMoodFill.style.width = `${moodPct}%`;
  if (ldMoodLbl) ldMoodLbl.textContent = `${getTempoGearBadge()} · %${moodPct} | 🕺 HALAY: ${activeCount}/${goalTarget}`;

  hud.updateCounters(activeCount, goalTarget, goalsHit, audio.bpm, heat, teamScores);
  hud.updateCombo(comboCount);
}

function applyStudioCommand(cmd, value) {
  if (cmd === "scene_mode" && value) {
    halay.setSceneMode(value);
    hud.setModeHeader(value);
    const sel = document.getElementById("scene-mode-select");
    if (sel) sel.value = value;
    if (value === "horon") {
      audio.setPreset("karadeniz");
      const msel = document.getElementById("music-preset-select");
      if (msel) msel.value = "karadeniz";
    }
    hud.showPopBanner(
      value === "zeybek" ? "🦅 ZEYBEK & EFE MEYDANI!" : (value === "kapisma" ? "⚔️ GELİN VS DAMAT!" : (value === "horon" ? "🌊 DÜĞÜN HORONU!" : (value === "halay_snake" ? "🐍 MEYDAN HALAYI!" : "💍 KIR DÜĞÜNÜ!"))),
      value === "zeybek" ? "Sohbete 'zeybek' veya 'efe' yaz!" : (value === "kapisma" ? "Sohbete 'gelin' veya 'damat' yaz!" : "Halay dizilimi değiştirildi"),
      "#fde047"
    );
  } else if (cmd === "avatar_style" && value) {
    halay.setAvatarStyle(value);
    const sel = document.getElementById("avatar-style-select");
    if (sel) sel.value = value;
  } else if (cmd === "music_preset" && value) {
    audio.setPreset(value);
    const sel = document.getElementById("music-preset-select");
    if (sel) sel.value = value;
  } else if (cmd === "tts_enabled") {
    audio.ttsEnabled = !!value;
    const chk = document.getElementById("chk-tts");
    if (chk) chk.checked = !!value;
  } else if (cmd === "demo_crowd") {
    const on = !!value;
    halay.setDemoCrowdEnabled(on);
    const chk = document.getElementById("chk-starter");
    if (chk) chk.checked = on;
  } else if (cmd === "sim_chat" && value && typeof value === "object") {
    halay.showSpeechBubble(value.user, value.text, { isRealViewer: true, source: "sim" });
    appendLiveFeed("chat", value.user, value.text);
  } else if (cmd === "banner_text" && typeof value === "string") {
    bannerCustomEdited = true;
    topBanner.textContent = value;
    const inp = document.getElementById("banner-text-input");
    if (inp && document.activeElement !== inp) inp.value = value;
  } else if (cmd === "sfx_clap") {
    audio.playClapBurst(10);
    halay.triggerMassJump(false);
    heat = Math.min(1, heat + 0.16);
    hud.showPopBanner("👏 ALKIŞ TUFANI!", "Meydan inliyor!", "#38bdf8");
  } else if (cmd === "sfx_whistle") {
    audio.playWhistleZilgit();
    audio.boostTempo(18);
    heat = Math.min(1, heat + 0.2);
    hud.showPopBanner("😗 ZILGIT & TEY!", "Tempo yükseldi!", "#fb923c");
  } else if (cmd === "sfx_gold") {
    audio.playCoinChime();
    halay.pinBrideGroomGold(2);
    hud.showPopBanner("🪙 TAKI MERASİMİ!", "Gelin & Damada altın takıldı!", "#fde047");
  } else if (cmd === "sfx_confetti") {
    audio.playWinFanfare();
    worldFX.spawnCelebration(new THREE.Vector3(0, 2.2, -0.5), 110, false);
    hud.showPopBanner("🎆 DÜĞÜN KONFETİSİ!", "İyi eğlenceler!", "#c084fc");
  } else if (cmd === "sfx_squeeze") {
    halay.triggerMassJump(true);
    audio.boostTempo(22);
    heat = Math.min(1, heat + 0.25);
    hud.showPopBanner("🔥 HOBAAA ZIPLAAA!", "Halay sıkıştı!", "#f87171");
  } else if (cmd === "bocek_action" && value && typeof value === "object") {
    executeBocekRoleAction(value.role, value.user, value.coins, value.giftName);
  }
  updateStatsUI();
}

function bumpLocalSupporterRank(user, addCoins = 1) {
  if (!user?.uid) return;
  let found = currentLeaderboard.find((x) => x.uid === user.uid);
  if (!found) {
    found = { uid: user.uid, nickname: user.nickname || "Misafir", score: 0, coins: 0 };
    currentLeaderboard.push(found);
  }
  found.coins = (found.coins || found.score || 0) + addCoins;
  found.score = found.coins;
  currentLeaderboard.sort((a, b) => (b.coins || b.score || 0) - (a.coins || a.score || 0));
  renderRightDashboardLeaders(currentLeaderboard);
  if (currentLeaderboard[0]) {
    updateRightDashboardBoss(currentLeaderboard[0]);
  }
}

function executeBocekRoleAction(role, userObj, coins = 1, giftName = "Gül") {
  const u = userObj || { uid: `guest_${Date.now()}`, nickname: "Misafir", coins };
  u.coins = (u.coins || 0) + coins;
  bumpLocalSupporterRank(u, coins);

  if (role === "join") {
    halay.joinHalay([u]);
    triggerInteractionFocus(u, 1.0);
    showJoinToast([u]);
    pushRightToast("💃", u.nickname, "halaya katıldı!", false);
    audio.boostTempo(5);
  } else if (role === "halaybasi") {
    halay.joinHalay([{ ...u, outfit: "halaybasi" }]);
    halay.triggerGiftEffect(u, "boss", coins);
    updateRightDashboardBoss(u);
    showGiftAlert(`🎉 ${escapeHtml(u.nickname)} 🎉`, `Halay Başı Oldu! <span class="bga-coin">🪙 ${coins}</span>`);
    pushRightToast("👑", u.nickname, "Halay Başı oldu!", true);
    audio.playCoinChime();
  } else if (role === "davulcu") {
    updateRightDashboardBoss(undefined, u);
    showGiftAlert(`🎉 ${escapeHtml(u.nickname)} 🎉`, `${escapeHtml(giftName || "Davul")} gönderdi! <span class="bga-coin">🪙 ${coins || 30}</span>`);
    pushRightToast("🥁", u.nickname, "Davulcu oldu!", true);
    audio.playCoinChime();
  } else if (role === "zurnaci") {
    updateRightDashboardBoss(undefined, undefined, u);
    showGiftAlert(`🎉 ${escapeHtml(u.nickname)} 🎉`, `${escapeHtml(giftName || "Zurna")} gönderdi! <span class="bga-coin">🪙 ${coins || 50}</span>`);
    pushRightToast("🎺", u.nickname, "Zurnacı oldu!", true);
    audio.playCoinChime();
  } else if (role === "gelin") {
    updateRightDashboardBoss(undefined, undefined, undefined, u);
    showGiftAlert(`🎉 ${escapeHtml(u.nickname)} 🎉`, `Gelin Oldu! <span class="bga-coin">🪙 ${coins || 99}</span>`);
    pushRightToast("👰", u.nickname, "Gelin oldu!", true);
    worldFX.spawnCelebration(new THREE.Vector3(-0.62, 1.8, -0.55), 75, true);
    audio.playCoinChime();
  } else if (role === "damat") {
    updateRightDashboardBoss(undefined, undefined, undefined, undefined, u);
    showGiftAlert(`🎉 ${escapeHtml(u.nickname)} 🎉`, `Damat Oldu! <span class="bga-coin">🪙 ${coins || 99}</span>`);
    pushRightToast("🤵", u.nickname, "Damat oldu!", true);
    worldFX.spawnCelebration(new THREE.Vector3(0.62, 1.8, -0.55), 75, true);
    audio.playCoinChime();
  } else if (role === "konfeti") {
    worldFX.spawnCelebration(new THREE.Vector3(0, 2.5, -0.5), 140, false);
    halay.triggerMassJump(false);
    showGiftAlert(`🎉 ${escapeHtml(u.nickname)} 🎉`, `Konfeti Pat Pat gönderdi! <span class="bga-coin">🪙 ${coins || 150}</span>`);
    pushRightToast("🎊", u.nickname, "Konfeti Pat Pat x1", true);
    audio.playWinFanfare();
  } else if (role === "istek") {
    showGiftAlert(`🎉 ${escapeHtml(u.nickname)} 🎉`, `İstek Şarkı gönderdi! <span class="bga-coin">🪙 ${coins || 199}</span>`);
    pushRightToast("🎵", u.nickname, "İstek Şarkı x1", true);
    currentRequestedBy = u.nickname;
    sendCmd({ action: "jukebox_next" });
    audio.playCoinChime();
  } else if (role === "parasac") {
    worldFX.spawnMoneyRain(130);
    worldFX.triggerFever(6.0);
    halay.triggerGiftEffect(u, "boss", coins || 500);
    showGiftAlert(`🎉 ${escapeHtml(u.nickname)} 🎉`, `${escapeHtml(giftName || "Para Tabancası")} gönderdi! <span class="bga-coin">🪙 ${coins || 500}</span>`);
    pushRightToast("🎁", u.nickname, `${giftName || "Para Tabancası"} x1`, true);
    audio.playWinFanfare();
  }
  updateStatsUI();
}

let ws = null;
function sendCmd(payload) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function connectWebSocket() {
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  ws = new WebSocket(`${proto}//${location.host}/ws`);
  ws.onmessage = (ev) => {
    let msg;
    try {
      msg = JSON.parse(ev.data);
    } catch {
      return;
    }
    if (msg.type === "seed_halay") {
      const seededUsers = msg.users || [];
      halay.seedHalay(seededUsers);
      if (seededUsers.length > 0) {
        showJoinToast(seededUsers.slice(-3));
      }
      checkHalayGoalMilestones(false);
      updateStatsUI();
    } else if (msg.type === "join_halay") {
      const users = msg.users || [];
      halay.joinHalay(users);
      users.forEach((u) => appendLiveFeed("join", u, "halaya girdi!"));
      showJoinToast(users);
      if (users.length > 0) triggerInteractionFocus(users[0], 1.0);
      audio.boostTempo(5);
      heat = Math.min(1, heat + 0.08 * users.length);
      checkHalayGoalMilestones(true);
      updateStatsUI();
    } else if (msg.type === "chat") {
      if (typeof msg.total_comments === "number") {
        liveComments = Math.max(liveComments, msg.total_comments);
      } else {
        liveComments += 1;
      }
      if (typeof msg.viewer_count === "number" && msg.viewer_count > 0) {
        liveViewers = msg.viewer_count;
      }
      if (msg.tempo_gear) {
        currentTempoGear = msg.tempo_gear;
        halay.setTempoGear(msg.tempo_gear);
      }
      halay.showSpeechBubble(msg.user, msg.text, { isRealViewer: true, source: "chat" });
      if (msg.user) triggerInteractionFocus(msg.user, 1.0);
      if (msg.announcer_soz) {
        halay.showAnnouncerBubble(msg.announcer_soz);
        speakCachedAnnouncer(msg.announcer_soz);
      }
      const matchedCity = parseCityFromChat(msg.text);
      if (matchedCity) {
        recordCityVote(matchedCity);
      }
      if (msg.cmd_action || msg.team) {
        halay.applyUserCommand(msg.user, msg.cmd_action, msg.team);
        if (msg.cmd_action === "clap") audio.playClapBurst(4);
      }
      if (msg.combo) {
        comboCount = msg.combo;
        comboDecayTimer = 6.5;
      }
      if (msg.team_scores) teamScores = msg.team_scores;
      if (msg.leaderboard) {
        hud.updateLeaderboard(msg.leaderboard);
        renderRightDashboardLeaders(msg.leaderboard);
      }
      if (msg.city_leaderboard) {
        renderRightDashboardCities(msg.city_leaderboard);
      }
      heat = Math.min(1, heat + 0.04);
      updateStatsUI();
    } else if (msg.type === "like") {
      if (msg.user) triggerInteractionFocus(msg.user, 1.0);
      if (typeof msg.total_likes === "number") {
        liveLikes = Math.max(liveLikes, msg.total_likes);
      } else {
        liveLikes += (msg.count || 1);
      }
      if (typeof msg.viewer_count === "number" && msg.viewer_count > 0) {
        liveViewers = msg.viewer_count;
      }
      if (msg.tempo_gear) {
        currentTempoGear = msg.tempo_gear;
        halay.setTempoGear(msg.tempo_gear);
      }
      if (msg.leaderboard) {
        hud.updateLeaderboard(msg.leaderboard);
        renderRightDashboardLeaders(msg.leaderboard);
      }
      if (msg.city_leaderboard) {
        renderRightDashboardCities(msg.city_leaderboard);
      }
      audio.boostTempo(Math.min(9, (msg.count || 10) * 0.14));
      heat = Math.min(1, heat + Math.min(0.12, (msg.count || 5) * 0.006));
      if (msg.team_scores) teamScores = msg.team_scores;
      updateStatsUI();
    } else if (msg.type === "like_goal") {
      audio.playClapBurst(10);
      halay.triggerMassJump(false);
      heat = Math.min(1, heat + 0.22);
      if (msg.tempo_gear) {
        currentTempoGear = msg.tempo_gear;
        halay.setTempoGear(msg.tempo_gear);
      }
      if (msg.leaderboard) {
        hud.updateLeaderboard(msg.leaderboard);
        renderRightDashboardLeaders(msg.leaderboard);
      }
      if (msg.city_leaderboard) {
        renderRightDashboardCities(msg.city_leaderboard);
      }
      hud.showPopBanner("👏 100 BEĞENİ ALKIŞI!", `Toplam ${msg.total_claps}. alkış tufanı!`, "#38bdf8");
      updateStatsUI();
    } else if (msg.type === "fever_burst") {
      comboCount = msg.combo || 15;
      comboDecayTimer = 7.0;
      heat = 1.0;
      worldFX.triggerFever(7.0);
      halay.triggerMassJump(true);
      audio.playWinFanfare();
      hud.showPopBanner(`🔥 x${comboCount} MEYDAN FEVER!`, "Işık şovu ve tam coşku aktif!", "#f59e0b");
      updateStatsUI();
    } else if (msg.type === "gift") {
      const dm = Number(msg.diamonds || 1);
      halay.triggerGiftEffect(msg.user, msg.tier, dm);
      hud.flashLadderTier(msg.tier, msg.user.nickname);
      audio.playCoinChime();
      audio.boostTempo(msg.tier === "boss" ? 36 : (msg.tier === "medium" ? 20 : 10));
      heat = Math.min(1, heat + (msg.tier === "boss" ? 0.45 : 0.22));

      // 3D Takı Sandığı açılışı ve altın fışkırma animasyonu
      worldFX.openGiftChest(3.5);
      recordChestGift(dm, msg.user);

      if (msg.combo) {
        comboCount = msg.combo;
        comboDecayTimer = 6.5;
      }
      if (msg.team_scores) teamScores = msg.team_scores;
      if (msg.leaderboard) {
        hud.updateLeaderboard(msg.leaderboard);
        renderRightDashboardLeaders(msg.leaderboard);
      }
      if (msg.city_leaderboard) {
        renderRightDashboardCities(msg.city_leaderboard);
      }
      if ("halaybasi" in msg || "davulcu" in msg || "zurnaci" in msg || "gelin" in msg || "damat" in msg) {
        if (msg.halaybasi) hud.updateHalaybasi(msg.halaybasi);
        updateRightDashboardBoss(msg.halaybasi, msg.davulcu, msg.zurnaci, msg.gelin, msg.damat);
      }
      if (dm >= 500) {
        worldFX.spawnMoneyRain(120);
        worldFX.spawnFireworks(0, -12);
        worldFX.spawnMesale(-4.5, -2.5);
        worldFX.spawnMesale(4.5, -2.5);
      } else if (dm >= 150) {
        worldFX.spawnCelebration(new THREE.Vector3(0, 2.5, -0.5), 140, false);
        worldFX.spawnFireworks(0, -12);
      } else if (dm >= 50) {
        worldFX.spawnFireworks(0, -12);
      } else if (dm >= 99) {
        if (!currentGelinObj || currentGelinObj.uid === msg.user.uid) {
          updateRightDashboardBoss(undefined, undefined, undefined, { ...msg.user, coins: dm });
        } else {
          updateRightDashboardBoss(undefined, undefined, undefined, undefined, { ...msg.user, coins: dm });
        }
      }

      const gTitle = escapeHtml(msg.gift_name || "Hediye");
      showGiftAlert(
        `🎉 ${escapeHtml(msg.user.nickname)} 🎉`,
        `${gTitle} gönderdi! <span class="bga-coin">🪙 ${dm}</span>`
      );
      if (msg.tier === "boss" || msg.vip_role === "halaybasi") {
        worldFX.triggerFever(5.0);
        speakCachedAnnouncer(`Yeni halaybaşımız ${msg.user.nickname}! Mendili eline aldı!`);
      } else if (msg.vip_role === "davulcu") {
        speakCachedAnnouncer(`${msg.user.nickname} düğün davulcusu oldu, vur tokmağa!`);
      } else if (msg.vip_role === "zurnaci") {
        speakCachedAnnouncer(`${msg.user.nickname} zurnacı koltuğuna geçti!`);
      } else if (msg.tier === "medium") {
        speakCachedAnnouncer(`${msg.user.nickname} düğüne altın taktı, kesesine bereket!`);
      }
      checkHalayGoalMilestones(true);
      updateStatsUI();
    } else if (msg.type === "jukebox_play" || msg.type === "jukebox_state") {
      if (typeof msg.shuffle === "boolean") jukeboxShuffle = msg.shuffle;
      if (msg.active_category) jukeboxCategory = msg.active_category;
      if (msg.dj_queue) renderDjQueue(msg.dj_queue);
      if (msg.cached_count) updateCacheBadge(msg.cached_count, msg.total_tracks);
      syncJukeboxControlsUI();
      if (msg.current) {
        const localIdx = jukeboxTracks.findIndex((t) => t.id === msg.current.id);
        if (localIdx >= 0) jukeboxTracks[localIdx] = msg.current;
        if (msg.type === "jukebox_play" || !audio.currentTrack) {
          currentRequestedBy = msg.requested_by || "";
          audio.playYouTubeTrack(msg.current, audio.desiredPlaying);
          if (msg.requested_by) {
            hud.showPopBanner("🎧 DJ İSTEK PARÇA!", `${msg.requested_by} → ${msg.current.title.slice(0, 32)}`, "#34d399");
          }
        }
      }
    } else if (msg.type === "jukebox_dj_queued") {
      if (msg.dj_queue) renderDjQueue(msg.dj_queue);
      if (msg.track && msg.requested_by) {
        appendLiveFeed("dj", { nickname: msg.requested_by }, `İstek sıraya alındı: #${msg.track.index} ${msg.track.title.slice(0, 36)}`);
        hud.showPopBanner("🎧 İSTEK SIRAYA ALINDI!", `@${msg.requested_by}: #${msg.track.index}`, "#38bdf8");
      }
    } else if (msg.type === "jukebox_cached") {
      const target = jukeboxTracks.find((t) => t.id === msg.id);
      if (target) target.cached = true;
      if (msg.cached_count) updateCacheBadge(msg.cached_count, jukeboxTracks.length);
      renderPlaylistRows();
    } else if (msg.type === "studio_control") {
      applyStudioCommand(msg.cmd, msg.value);
    } else if (msg.type === "live_feed") {
      if (typeof msg.viewer_count === "number" && msg.viewer_count > 0) liveViewers = msg.viewer_count;
      if (typeof msg.total_likes === "number") liveLikes = Math.max(liveLikes, msg.total_likes);
      if (typeof msg.total_comments === "number") liveComments = Math.max(liveComments, msg.total_comments);
      appendLiveFeed(msg.kind, msg.user, msg.detail);
      if (msg.kind === "chat" && msg.detail) {
        halay.showSpeechBubble(msg.user, msg.detail, { isRealViewer: true, source: "live_feed" });
      }
      updateStatsUI();
    } else if (msg.type === "lan_info") {
      const bestUrl = msg.public_url || (msg.lan_ip ? `http://${msg.lan_ip}:9944/?obs=1` : "");
      if (bestUrl) {
        const lanInp = document.getElementById("lan-url-box");
        if (lanInp) lanInp.value = bestUrl;
        const qrImg = document.getElementById("lan-qr-img");
        if (qrImg) {
          qrImg.style.display = "block";
          qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=110x110&margin=4&data=${encodeURIComponent(bestUrl)}`;
        }
      }
    } else if (msg.type === "reset_halay") {
      halay.resetAll();
      goalStepIdx = 0;
      goalTarget = GOAL_STEPS[0];
      goalsHit = 0;
      heat = 0.2;
      comboCount = 0;
      liveLikes = 0;
      liveComments = 0;
      currentBossName = "";
      currentTempoGear = "orta";
      halay.setTempoGear("orta");
      teamScores = { gelin: 0, damat: 0 };
      hud.updateLeaderboard([]);
      hud.updateHalaybasi(null);
      renderRightDashboardLeaders([]);
      renderRightDashboardCities([]);
      updateRightDashboardBoss(null, null, null);
      const deCard = document.getElementById("dash-events-card");
      const deList = document.getElementById("dash-events-list");
      if (deCard) deCard.classList.add("hidden");
      if (deList) deList.innerHTML = "";
      updateStatsUI();
    } else if (msg.type === "status") {
      syncStatusFromServer(msg);
    }
  };
  ws.onclose = () => {
    if (window._wsPingInterval) clearInterval(window._wsPingInterval);
    setTimeout(connectWebSocket, 1800);
  };
  if (window._wsPingInterval) clearInterval(window._wsPingInterval);
  window._wsPingInterval = setInterval(() => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ action: "ping" }));
    }
  }, 14000);
}

let initialStatusSynced = false;
let lastDrawerInteractTs = 0;
let bannerCustomEdited = false;

function updateStageConnPill(_msg) {
  // Stage waiting/username pill disabled per user preference
}

function syncStatusFromServer(msg) {
  const badge = document.getElementById("conn-badge");
  liveViewers = msg.viewer_count || 0;
  if (typeof msg.total_likes === "number") {
    liveLikes = msg.total_likes;
  }
  if (typeof msg.total_comments === "number") {
    liveComments = msg.total_comments;
  }
  updateStageConnPill(msg);

  if (badge) {
    if (msg.connected) {
      badge.className = "badge live";
      badge.textContent = `🔴 CANLI BAĞLI: @${msg.username}`;
    } else if (msg.watching && msg.username) {
      badge.className = "badge waiting";
      badge.textContent = `⏳ YAYIN BEKLENİYOR: @${msg.username}`;
    } else {
      badge.className = "badge waiting";
      badge.textContent = "CANLI YAYIN BEKLENİYOR";
    }
  }
  if (msg.note) {
    const sn = document.getElementById("status-note");
    if (sn) sn.textContent = msg.note;
  }

  // Never clobber open Settings controls or active mobile <select>/input interactions during 2-6s status ticks
  const drawerOpen = drawer ? !drawer.classList.contains("hidden") : false;
  const userEditingSettings = initialStatusSynced && (drawerOpen || Date.now() - lastDrawerInteractTs < 5000);

  if (!userEditingSettings) {
    if (msg.username) {
      const uInp = document.getElementById("tiktok-user-input");
      if (uInp && document.activeElement !== uInp) uInp.value = msg.username;
    }
    document.getElementById("chk-kw").checked = !!msg.join_on_keyword;
    document.getElementById("chk-any-chat").checked = !!msg.join_on_any_chat;
    document.getElementById("chk-follow").checked = !!msg.join_on_follow;
    document.getElementById("chk-enter").checked = !!msg.join_on_enter;

    if (msg.like_threshold) {
      const thInp = document.getElementById("like-threshold-input");
      if (thInp && document.activeElement !== thInp) thInp.value = msg.like_threshold;
    }
    if (msg.tier2_min) {
      const t2 = document.getElementById("tier2-input");
      if (t2 && document.activeElement !== t2) t2.value = msg.tier2_min;
    }
    if (msg.tier3_min) {
      const t3 = document.getElementById("tier3-input");
      if (t3 && document.activeElement !== t3) t3.value = msg.tier3_min;
    }
    if (msg.scene_mode) {
      document.getElementById("scene-mode-select").value = msg.scene_mode;
    }
    if (msg.avatar_style) {
      document.getElementById("avatar-style-select").value = msg.avatar_style;
    }
    if (msg.music_preset) {
      document.getElementById("music-preset-select").value = msg.music_preset;
    }
    if (typeof msg.tts_enabled === "boolean") {
      document.getElementById("chk-tts").checked = msg.tts_enabled;
    }
  }

  if (msg.tier2_min || msg.tier3_min) {
    if (msg.tier2_min) hud.tier2Min = msg.tier2_min;
    if (msg.tier3_min) hud.tier3Min = msg.tier3_min;
    hud.renderLadder();
  }
  if (msg.scene_mode && halay.sceneMode !== msg.scene_mode) {
    halay.setSceneMode(msg.scene_mode);
    hud.setModeHeader(msg.scene_mode);
  }
  if (msg.avatar_style && halay.avatarStyle !== msg.avatar_style) {
    halay.setAvatarStyle(msg.avatar_style);
  }
  if (msg.music_preset && audio.presetKey !== msg.music_preset) {
    audio.setPreset(msg.music_preset);
  }
  if (typeof msg.tts_enabled === "boolean") {
    audio.ttsEnabled = msg.tts_enabled;
    const miniTts = document.getElementById("mini-btn-tts");
    if (miniTts) miniTts.textContent = msg.tts_enabled ? "🗣️" : "🔇";
  }
  if (msg.tempo_gear && currentTempoGear !== msg.tempo_gear) {
    currentTempoGear = msg.tempo_gear;
    halay.setTempoGear(msg.tempo_gear);
  }
  if (msg.team_scores) teamScores = msg.team_scores;
  if (msg.leaderboard) {
    hud.updateLeaderboard(msg.leaderboard);
    renderRightDashboardLeaders(msg.leaderboard);
  }
  if (msg.city_leaderboard) {
    renderRightDashboardCities(msg.city_leaderboard);
  }
  if ("halaybasi" in msg || "davulcu" in msg || "zurnaci" in msg) {
    hud.updateHalaybasi(msg.halaybasi);
    updateRightDashboardBoss(msg.halaybasi, msg.davulcu, msg.zurnaci);
  }
  initialStatusSynced = true;
  updateStatsUI();
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    if (!ws || ws.readyState === WebSocket.CLOSED) {
      connectWebSocket();
    }
    if (audio.desiredPlaying && !audio.isPlaying && !audio.needsGestureUnlock) {
      audio._attemptActivePlay?.();
    }
  }
});

loadJukeboxCatalog();
connectWebSocket();
updateChestBarUI();
updateCityBattleUI();

// Studio UI & Tabs Wiring
document.getElementById("obs-url-box").value = `${location.origin}/?obs=1`;

function activateStudioTab(targetId) {
  if (!targetId) return;
  document.querySelectorAll(".studio-tabs .tab-btn").forEach((b) => b.classList.toggle("active", b.dataset.tab === targetId));
  document.querySelectorAll(".tab-pane").forEach((p) => p.classList.toggle("active", p.id === targetId));
}

document.querySelectorAll(".studio-tabs .tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    lastDrawerInteractTs = Date.now();
    activateStudioTab(btn.dataset.tab);
  });
});

if (drawer) {
  ["pointerdown", "touchstart", "input", "change", "focusin"].forEach((evName) => {
    drawer.addEventListener(evName, (ev) => {
      lastDrawerInteractTs = Date.now();
      ev.stopPropagation();
    }, { passive: true });
  });
}

function openDrawer(tabId = "") {
  if (!drawer) return;
  lastDrawerInteractTs = Date.now();
  if (tabId) activateStudioTab(tabId);
  drawer.classList.remove("hidden");
  stageFrame?.classList.add("ui-awake");
}

function closeDrawer() {
  if (!drawer) return;
  drawer.classList.add("hidden");
  wakeStageControls(2800);
  setTimeout(resizeStage, 30);
}

function toggleDrawer() {
  if (!drawer) return;
  if (drawer.classList.contains("hidden")) openDrawer();
  else closeDrawer();
}

document.getElementById("toggle-drawer-btn").onclick = (e) => {
  e.stopPropagation();
  toggleDrawer();
};
document.getElementById("close-drawer-btn").onclick = (e) => {
  e.stopPropagation();
  closeDrawer();
};
document.getElementById("mini-btn-settings")?.addEventListener("click", (e) => {
  e.stopPropagation();
  toggleDrawer();
});
document.getElementById("stage-conn-pill")?.addEventListener("click", (e) => {
  e.stopPropagation();
  if (drawer && !drawer.classList.contains("hidden")) closeDrawer();
  else openDrawer("tab-stream");
});
document.getElementById("dash-status-btn")?.addEventListener("click", (e) => {
  e.stopPropagation();
  if (drawer && !drawer.classList.contains("hidden")) closeDrawer();
  else openDrawer("tab-stream");
});

// HUD & Corner Mini Music Controls (works directly on Mobile ?obs=1 & Desktop)
document.getElementById("hud-btn-play").onclick = (e) => {
  e.stopPropagation();
  audio.toggle();
};
document.getElementById("hud-btn-next").onclick = (e) => {
  e.stopPropagation();
  audio.desiredPlaying = true;
  sendCmd({ action: "jukebox_next" });
};
document.getElementById("mini-btn-play")?.addEventListener("click", (e) => {
  e.stopPropagation();
  audio.toggle();
});
document.getElementById("mini-btn-next")?.addEventListener("click", (e) => {
  e.stopPropagation();
  audio.desiredPlaying = true;
  sendCmd({ action: "jukebox_next" });
});
document.getElementById("mini-btn-tts")?.addEventListener("click", (e) => {
  e.stopPropagation();
  const nextVal = !audio.ttsEnabled;
  audio.ttsEnabled = nextVal;
  if (!nextVal && "speechSynthesis" in window) {
    try { window.speechSynthesis.cancel(); } catch (_) {}
  }
  const chkTts = document.getElementById("chk-tts");
  if (chkTts) chkTts.checked = nextVal;
  const miniTts = document.getElementById("mini-btn-tts");
  if (miniTts) miniTts.textContent = nextVal ? "🗣️" : "🔇";
  sendCmd({ action: "studio_control", cmd: "tts_enabled", value: nextVal });
});

// Studio Jukebox Controls
document.getElementById("btn-audio").onclick = () => {
  audio.toggle();
};
document.getElementById("btn-jb-next").onclick = () => {
  audio.desiredPlaying = true;
  sendCmd({ action: "jukebox_next" });
};
document.getElementById("btn-jb-prev").onclick = () => {
  audio.desiredPlaying = true;
  sendCmd({ action: "jukebox_prev" });
};
document.getElementById("btn-jb-shuffle").onclick = () => {
  jukeboxShuffle = !jukeboxShuffle;
  syncJukeboxControlsUI();
  sendCmd({ action: "jukebox_options", shuffle: jukeboxShuffle });
};
document.getElementById("jb-volume-slider").oninput = (e) => {
  const pct = parseInt(e.target.value || "90", 10);
  document.getElementById("jb-vol-label").textContent = `${pct}%`;
  audio.setVolume(pct / 100);
};
document.getElementById("jb-search-input").oninput = (e) => {
  jukeboxSearch = e.target.value || "";
  renderPlaylistRows();
};
document.querySelectorAll("#jb-cat-chips .chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    jukeboxCategory = chip.dataset.cat || "all";
    syncJukeboxControlsUI();
    renderPlaylistRows();
    sendCmd({ action: "jukebox_options", category: jukeboxCategory });
  });
});

// TikTok Stream Connection
function doConnectUser() {
  const u = document.getElementById("tiktok-user-input").value.trim();
  const sid = document.getElementById("tiktok-session-input").value.trim();
  if (u) sendCmd({ action: "connect_tiktok", username: u, session_id: sid });
}
document.getElementById("btn-connect").onclick = doConnectUser;
document.getElementById("tiktok-user-input").addEventListener("keydown", (e) => {
  if (e.key === "Enter") doConnectUser();
});

document.getElementById("btn-discover").onclick = () => {
  document.getElementById("status-note").textContent = "🔍 Şu an yayında olan gerçek bir TikTok canlı odası aranıyor...";
  sendCmd({ action: "discover_live" });
};
document.getElementById("btn-disconnect").onclick = () => sendCmd({ action: "disconnect_tiktok" });
document.getElementById("btn-tikfinity").onclick = () => sendCmd({ action: "connect_tikfinity" });
document.getElementById("btn-reset").onclick = () => sendCmd({ action: "reset_halay" });

// Studio Preview Simulator Buttons
const SAMPLE_VIEWER_CHATS = [
  { uid: "test_viewer_1", nickname: "mehmet_34", text: "Selamlar halay yıkılıyor 🔥" },
  { uid: "test_viewer_2", nickname: "zeynep_ankara", text: "katıl ben de geldim!" },
  { uid: "test_viewer_3", nickname: "emre_kral", text: "Damat tarafı burda mı 🔵" },
  { uid: "test_viewer_4", nickname: "elif_su", text: "Gelin evi çok güçlü 🎀" },
  { uid: "test_viewer_5", nickname: "okan_27", text: "Halaybaşı uçuyor maşallah!" },
];
let simChatIdx = 0;
document.getElementById("btn-sim-add5").onclick = () => sendCmd({ action: "simulate_event", kind: "add_5" });
document.getElementById("btn-sim-chat")?.addEventListener("click", () => {
  const item = SAMPLE_VIEWER_CHATS[simChatIdx++ % SAMPLE_VIEWER_CHATS.length];
  const payload = { user: { uid: item.uid, nickname: item.nickname }, text: item.text };
  if (ws && ws.readyState === WebSocket.OPEN) {
    sendCmd({ action: "studio_control", cmd: "sim_chat", value: payload });
  } else {
    halay.showSpeechBubble(payload.user, payload.text, { isRealViewer: true, source: "sim" });
  }
});
document.getElementById("btn-sim-gold")?.addEventListener("click", () => sendCmd({ action: "simulate_event", kind: "test_gold" }));
document.getElementById("btn-sim-boss")?.addEventListener("click", () => sendCmd({ action: "simulate_event", kind: "test_boss" }));
document.getElementById("btn-sim-fever")?.addEventListener("click", () => sendCmd({ action: "simulate_event", kind: "test_fever" }));

// TikMax Signature Feature Simulation Buttons
document.getElementById("btn-sim-welcome")?.addEventListener("click", () => {
  const names = ["Zülküf", "Mert_Can", "Ayşe_06", "Baran_Ağa", "Esra_K", "Emre_34", "Fatma_Bahar"];
  const simNick = names[Math.floor(Math.random() * names.length)] + "_" + Math.floor(10 + Math.random() * 89);
  const u = { uid: "sim_w_" + Date.now(), nickname: simNick, team: Math.random() > 0.5 ? "gelin" : "damat" };
  halay.joinHalay([u]);
  triggerInteractionFocus(u, 1.0);
  showWelcomeAlert(simNick);
  audio.playCoinChime();
});

document.getElementById("btn-sim-gelin")?.addEventListener("click", () => {
  const eligible = halay.dancers.filter(d => !["walking_to_couple", "pinning_gift", "returning_from_couple"].includes(d.state));
  const picked = eligible.length > 0 ? eligible[Math.floor(Math.random() * eligible.length)] : halay.dancers[0];
  const u = picked ? { uid: picked.uid, nickname: picked.nickname } : { uid: "sim_g_" + Date.now(), nickname: "Ayşe_Altın" };
  halay.triggerGiftEffect(u, "medium", 10, "gelin");
});

document.getElementById("btn-sim-damat")?.addEventListener("click", () => {
  const eligible = halay.dancers.filter(d => !["walking_to_couple", "pinning_gift", "returning_from_couple"].includes(d.state));
  const picked = eligible.length > 0 ? eligible[Math.floor(Math.random() * eligible.length)] : halay.dancers[0];
  const u = picked ? { uid: picked.uid, nickname: picked.nickname } : { uid: "sim_d_" + Date.now(), nickname: "Mehmet_Dolar" };
  halay.triggerGiftEffect(u, "boss", 100, "damat");
});

document.getElementById("btn-sim-davul")?.addEventListener("click", () => {
  audio.boostTempo(32);
  worldFX.triggerFever(4.5);
  pushRightToast("🥁", "Davulcu", "Davulcu solo çoştu!", true);
});

document.getElementById("btn-sim-mesale")?.addEventListener("click", () => {
  worldFX.spawnMesale?.();
  worldFX.spawnFireworks?.(5);
  pushRightToast("💥", "Meşale", "Kırmızı meşaleler & fişekler patlatıldı!", true);
});

// Mode, Character, Makam, TTS, Demo Crowd & Optional Extra Bars Toggles
document.getElementById("scene-mode-select").onchange = (e) => {
  sendCmd({ action: "studio_control", cmd: "scene_mode", value: e.target.value });
};
document.getElementById("avatar-style-select").onchange = (e) => {
  sendCmd({ action: "studio_control", cmd: "avatar_style", value: e.target.value });
};
document.getElementById("music-preset-select").onchange = (e) => {
  sendCmd({ action: "studio_control", cmd: "music_preset", value: e.target.value });
};
document.getElementById("chk-tts").onchange = (e) => {
  sendCmd({ action: "studio_control", cmd: "tts_enabled", value: e.target.checked });
};
const arcadeChrome = document.getElementById("hud-arcade-chrome");
document.getElementById("chk-hud").onchange = (e) => {
  arcadeChrome?.classList.toggle("hidden", !e.target.checked);
};
document.getElementById("chk-starter")?.addEventListener("change", (e) => {
  const on = e.target.checked;
  halay.setDemoCrowdEnabled(on);
  sendCmd({ action: "studio_control", cmd: "demo_crowd", value: on });
  updateStatsUI();
});

// Soundboard & Safe-Zone Guide
document.getElementById("btn-sfx-clap").onclick = () => sendCmd({ action: "studio_control", cmd: "sfx_clap" });
document.getElementById("btn-sfx-whistle").onclick = () => sendCmd({ action: "studio_control", cmd: "sfx_whistle" });
document.getElementById("btn-sfx-gold").onclick = () => sendCmd({ action: "studio_control", cmd: "sfx_gold" });
document.getElementById("btn-sfx-confetti").onclick = () => sendCmd({ action: "studio_control", cmd: "sfx_confetti" });
document.getElementById("btn-sfx-squeeze").onclick = () => sendCmd({ action: "studio_control", cmd: "sfx_squeeze" });
document.getElementById("btn-safezone").onclick = () => {
  hud.toggleSafeZone();
  stageFrame.classList.toggle("safezone-preview");
};

window.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && drawer && !drawer.classList.contains("hidden")) {
    closeDrawer();
    return;
  }
  if (["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement?.tagName)) return;
  const k = e.key.toLowerCase();
  if (k === "h") toggleDrawer();
  else if (k === "n") sendCmd({ action: "jukebox_next" });
  else if (k === "1") sendCmd({ action: "studio_control", cmd: "sfx_clap" });
  else if (k === "2") sendCmd({ action: "studio_control", cmd: "sfx_whistle" });
  else if (k === "3") sendCmd({ action: "studio_control", cmd: "sfx_gold" });
  else if (k === "4") sendCmd({ action: "studio_control", cmd: "sfx_confetti" });
  else if (e.code === "Space") {
    e.preventDefault();
    sendCmd({ action: "studio_control", cmd: "sfx_squeeze" });
  }
});

// Rules & Coin Thresholds
function pushRules() {
  const th = Math.max(1, parseInt(document.getElementById("like-threshold-input").value || "500", 10));
  const t2 = Math.max(2, parseInt(document.getElementById("tier2-input").value || "20", 10));
  const t3 = Math.max(5, parseInt(document.getElementById("tier3-input").value || "50", 10));
  sendCmd({
    action: "update_rules",
    threshold: th,
    tier2_min: t2,
    tier3_min: t3,
    join_on_keyword: document.getElementById("chk-kw").checked,
    join_on_any_chat: document.getElementById("chk-any-chat").checked,
    join_on_follow: document.getElementById("chk-follow").checked,
    join_on_enter: document.getElementById("chk-enter").checked,
  });
}
["chk-kw", "chk-any-chat", "chk-follow", "chk-enter", "tier2-input", "tier3-input"].forEach((id) => {
  document.getElementById(id).onchange = pushRules;
});
document.getElementById("like-threshold-input").onchange = (e) => {
  pushRules();
  const txt = `${e.target.value} b3gen1 HALAYA KAT1l`;
  document.getElementById("banner-text-input").value = txt;
  sendCmd({ action: "studio_control", cmd: "banner_text", value: txt });
};
document.getElementById("banner-text-input").oninput = (e) => {
  bannerCustomEdited = true;
  topBanner.textContent = e.target.value;
  sendCmd({ action: "studio_control", cmd: "banner_text", value: e.target.value });
};

// Custom MP3 & URL Copy
document.getElementById("mp3-file-input").onchange = (e) => {
  if (e.target.files[0]) audio.loadCustomFile(e.target.files[0]);
};
document.getElementById("btn-clear-mp3").onclick = () => {
  audio.clearCustomFile();
  document.getElementById("mp3-file-input").value = "";
};
document.getElementById("camera-mode-select").onchange = (e) => { cameraMode = e.target.value; };

document.getElementById("btn-copy-obs").onclick = (e) => {
  navigator.clipboard.writeText(document.getElementById("obs-url-box").value);
  e.target.textContent = "✓";
  setTimeout(() => { e.target.textContent = "Kopyala"; }, 1400);
};
document.getElementById("btn-copy-lan").onclick = (e) => {
  navigator.clipboard.writeText(document.getElementById("lan-url-box").value);
  e.target.textContent = "✓";
  setTimeout(() => { e.target.textContent = "Kopyala"; }, 1400);
};

// 11692FonWDI ("Bocek Dugun Sahnesi") Interactive 3x3 Gift Card & CTA Wiring
const BOCEK_SIM_USERS = [
  { uid: "bocek_gul", nickname: "Gül" },
  { uid: "bocek_can", nickname: "Can" },
  { uid: "bocek_elif", nickname: "Elif" },
  { uid: "bocek_ali", nickname: "Ali" },
  { uid: "bocek_zeynep", nickname: "Zeynep" },
  { uid: "bocek_burak", nickname: "Burak" },
  { uid: "bocek_eda", nickname: "Eda" },
  { uid: "bocek_emre", nickname: "Emre" },
];
let bocekSimCounter = 0;

document.querySelectorAll("#bocek-gift-card .bgc-cell[data-sim-role]").forEach((cell) => {
  cell.addEventListener("click", (ev) => {
    ev.stopPropagation();
    const role = cell.dataset.simRole;
    const sample = BOCEK_SIM_USERS[bocekSimCounter++ % BOCEK_SIM_USERS.length];
    const roleMeta = {
      join: { coins: 1, giftName: "Gül" },
      halaybasi: { coins: 250, giftName: "Kraliyet Tacı" },
      davulcu: { coins: 30, giftName: "Düğün Davulu" },
      zurnaci: { coins: 50, giftName: "Altın Zurna" },
      gelin: { coins: 99, giftName: "Gelin Tacı" },
      damat: { coins: 99, giftName: "Damat Papyonu" },
      konfeti: { coins: 150, giftName: "Konfeti Pat Pat" },
      istek: { coins: 199, giftName: "İstek Şarkı" },
      parasac: { coins: 500, giftName: "Para Tabancası" },
    }[role] || { coins: 1, giftName: "Gül" };

    const payload = {
      role,
      user: { uid: `${sample.uid}_${bocekSimCounter}`, nickname: sample.nickname },
      coins: roleMeta.coins,
      giftName: roleMeta.giftName,
    };
    if (ws && ws.readyState === WebSocket.OPEN) {
      sendCmd({ action: "studio_control", cmd: "bocek_action", value: payload });
    } else {
      executeBocekRoleAction(payload.role, payload.user, payload.coins, payload.giftName);
    }
  });
});

document.getElementById("bocek-cta-pill")?.addEventListener("click", (ev) => {
  ev.stopPropagation();
  const sample = BOCEK_SIM_USERS[bocekSimCounter++ % BOCEK_SIM_USERS.length];
  const payload = {
    role: "join",
    user: { uid: `${sample.uid}_${bocekSimCounter}`, nickname: sample.nickname },
    coins: 1,
    giftName: "Gül",
  };
  if (ws && ws.readyState === WebSocket.OPEN) {
    sendCmd({ action: "studio_control", cmd: "bocek_action", value: payload });
  } else {
    executeBocekRoleAction("join", payload.user, 1, "Gül");
  }
});

document.getElementById("bocek-music-bar")?.addEventListener("click", (ev) => {
  ev.stopPropagation();
  audio.toggle();
});

renderRightDashboardLeaders([]);

// Render Loop
const clock = new THREE.Clock();
let hudTickAccum = 0;
let ctaBannerAccum = 0;
let ctaBannerIdx = 0;
const CTA_ROTATION_LINES = [
  "500 b3gen1 HALAYA KAT1l",
  "YORUMA ŞEHRİNİ YAZ · MEMLEKETİNİ ZİRVEYE TAŞI 🏙️",
  "HEDİYE AT · HALAYBAŞI / DAVULCU / ZURNACI OL 👑",
  "YORUMA 'HALAY' · 'HORON' · 'ZEYBEK' YAZ 🦅",
];

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const elapsed = clock.elapsedTime;

  audio.update(dt);
  heat = Math.max(0.18, heat - dt * 0.022);
  if (comboDecayTimer > 0) {
    comboDecayTimer -= dt;
    if (comboDecayTimer <= 0) {
      comboCount = 0;
      hud.updateCombo(0);
    }
  }

  if (!bannerCustomEdited) {
    ctaBannerAccum += dt;
    if (ctaBannerAccum >= 18.0) {
      ctaBannerAccum = 0;
      ctaBannerIdx = (ctaBannerIdx + 1) % CTA_ROTATION_LINES.length;
      if (topBanner) topBanner.textContent = CTA_ROTATION_LINES[ctaBannerIdx];
    }
  }

  hudTickAccum += dt;
  if (hudTickAccum >= 0.18) {
    hudTickAccum = 0;
    const bpmEl = document.getElementById("stat-bpm");
    if (bpmEl) bpmEl.textContent = `${Math.round(audio.bpm)} BPM`;
    const prog = audio.getProgress();
    const curEl = document.getElementById("jb-time-cur");
    const durEl = document.getElementById("jb-time-dur");
    const fillEl = document.getElementById("jb-progress-fill");
    if (curEl) curEl.textContent = fmtTime(prog.current);
    if (durEl) durEl.textContent = fmtTime(prog.duration);
    if (fillEl) fillEl.style.width = prog.duration > 0 ? `${Math.min(100, (prog.current / prog.duration) * 100).toFixed(1)}%` : "0%";

    hud.updateNowPlaying(audio.currentTrack, audio.isPlaying, audio.isLoadingTrack, audio.getSpectrumBars(4), currentRequestedBy);
    const liveCnt = halay.starterCrowdEnabled ? halay.dancers.length : halay.getRealDancerCount();
    hud.updateCounters(liveCnt, goalTarget, goalsHit, audio.bpm, heat, teamScores);
    const ldMoodFill = document.getElementById("livedeck-mood-fill");
    const ldMoodLbl = document.getElementById("livedeck-mood-label");
    const moodPct = Math.min(100, Math.max(24, Math.round(heat * 100 + liveCnt * 4)));
    if (ldMoodFill) ldMoodFill.style.width = `${moodPct}%`;
    if (ldMoodLbl) ldMoodLbl.textContent = `${getTempoGearBadge()} · %${moodPct} | 🕺 HALAY: ${liveCnt}/${goalTarget}`;
  }

  if (runnerFocusHold > 0) runnerFocusHold -= dt;
  const directorFocus = halay.getActiveDirectorFocus();

  if (cameraMode !== "free") {
    controls.enabled = false;
    if (interactionFocusTimer > 0) {
      interactionFocusTimer -= dt;
      const p = interactionFocusDancer?.rig?.root?.position;
      if (p) {
        // Tris: 1 saniye etkileşimde bulunan izleyicinin yüzünü ve ismini gösterip Gelin & Damat'a dön
        const fz = -0.55 - p.z;
        if (fz >= -0.25) {
          camTargetPos.set(p.x * 0.72, 2.85, p.z + 4.35);
        } else {
          camTargetPos.set(p.x + (p.x >= 0 ? 2.65 : -2.65), 2.95, p.z + 2.35);
        }
        camLookAtPos.set(p.x, 1.38, p.z);
      }
    } else if (halay.activeGifter && ["walking_to_couple", "pinning_gift", "returning_from_couple"].includes(halay.activeGifter.state)) {
      // Geline / Damada takı takma yürüyüşü ve göğüsteki kırmızı kurdeleye takma anı
      const gp = halay.activeGifter.rig.root.position;
      camTargetPos.set(gp.x * 0.42, 3.25, 5.15);
      camLookAtPos.set(gp.x * 0.35, 1.28, -0.45);
    } else if (directorFocus && directorFocus.type === "welcome" && directorFocus.pos) {
      const wp = directorFocus.pos;
      camTargetPos.set(wp.x * 0.72, 2.85, wp.z + 4.35);
      camLookAtPos.set(wp.x, 1.38, wp.z);
    } else {
      // Tris: Ana kamera her zaman merkezdeki GELİN VE DAMAT'a dönük olsun; Davulcu, Zurnacı ve arkadaki Halay net görünsün!
      const breathX = Math.sin(elapsed * 0.16) * 0.25;
      camTargetPos.set(breathX, 4.55, 8.15);
      camLookAtPos.set(0, 1.30, -0.95);
    }
    camera.position.lerp(camTargetPos, Math.min(1, dt * 4.6));
    controls.target.lerp(camLookAtPos, Math.min(1, dt * 5.2));
    camera.lookAt(controls.target);
  } else {
    controls.enabled = true;
    controls.update();
  }

  const effectiveBpm = audio.bpm + audio.beatEnergy * 14;
  maybeTriggerWobble(effectiveBpm);
  worldFX.updateWorld(elapsed, dt, audio.beatEnergy);
  const labelW = labelsLayer?.clientWidth || stageFrame.clientWidth || 540;
  const labelH = labelsLayer?.clientHeight || stageFrame.clientHeight || 960;
  halay.update(dt, effectiveBpm, camera, labelW, labelH);
  renderer.render(scene, camera);
}
animate();
