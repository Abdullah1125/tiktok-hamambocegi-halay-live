// Canlı yayın oyunları için ortak yardımcılar (WebSocket, bildirimler, avatar, demo).
export const PARAMS = new URLSearchParams(location.search);
export const IS_OBS = PARAMS.get("obs") === "1";
export const DEMO = PARAMS.get("demo") === "1";
if (IS_OBS) document.body.classList.add("obs");

export const $ = (id) => document.getElementById(id);
export function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

export function toast(html, kind = "") {
  const feed = $("feed");
  if (!feed) return;
  const el = document.createElement("div");
  el.className = `toast ${kind}`;
  el.innerHTML = html;
  feed.prepend(el);
  while (feed.children.length > 5) feed.lastChild.remove();
  setTimeout(() => el.remove(), 5000);
}

export function isRose(msg) {
  const n = String(msg.gift_name || "").toLowerCase();
  return Number(msg.gift_id) === 5655 || /gül|gul|rose|rosa|роза/.test(n);
}

// Ucuz / yaygın hediyeleri oyun aksiyonlarına eşle (ID öncelikli, sonra çok dilli isim).
export const GIFTS = {
  rose: { id: 5655, emoji: "🌹", label: "Gül" },
  tiktok: { id: 5269, emoji: "🎵", label: "TikTok" },
  gg: { id: 6064, emoji: "🎮", label: "GG" },
  icecream: { id: 5827, emoji: "🍦", label: "Dondurma" },
  heart: { id: 5487, emoji: "🫰", label: "Parmak Kalp" },
  donut: { id: 5879, emoji: "🍩", label: "Donut" },
};
export function giftKey(id, name, unit) {
  id = Number(id) || 0;
  for (const [k, v] of Object.entries(GIFTS)) if (v.id === id) return k;
  const n = String(name || "").toLowerCase();
  if (/donut|doughnut/.test(n)) return "donut";
  if (Number(unit) >= 30) return "big";
  if (/gül|gul|rose|rosa|роза/.test(n)) return "rose";
  if (/^tik ?tok$/.test(n)) return "tiktok";
  if (/^gg$/.test(n)) return "gg";
  if (/dondurma|ice ?cream|eiswaffel|helado/.test(n)) return "icecream";
  if (/parmak|finger ?he|fingerherz|kalp|heart/.test(n)) return "heart";
  if (/donut|doughnut/.test(n)) return "donut";
  return Number(unit) >= 30 ? "big" : "other";
}

// Hediye listesini ikonlarıyla çizer: entries = [[key, "açıklama"], ...]
let giftCatalog = null;
export async function renderGiftLegend(el, entries) {
  if (!el) return;
  el.innerHTML = entries.map(([k, txt]) => {
    const gf = GIFTS[k] || { emoji: "🎁", label: "Büyük hediye" };
    return `<span class="gl" data-k="${k}"><i>${gf.emoji}</i><b>${esc(gf.label)}</b> ${esc(txt)}</span>`;
  }).join("");
  try {
    giftCatalog = giftCatalog || (await (await fetch("/assets/gifts.json")).json()).data || [];
    for (const span of el.querySelectorAll(".gl")) {
      const gf = GIFTS[span.dataset.k];
      const item = gf && giftCatalog.find((g) => g.id === gf.id);
      if (!item || !item.image) continue;
      const img = new Image();
      img.onload = () => { const i = span.querySelector("i"); i.textContent = ""; i.appendChild(img); };
      img.src = item.image;
    }
  } catch { /* ikon yoksa emoji kalır */ }
}

export function nick(u) { return String((u && (u.nickname || u.uid)) || "İzleyici").slice(0, 24); }

// Yayın olaylarını sadeleştirilmiş tek tipe çevirir:
// { kind: "gift"|"like"|"chat"|"follow"|"share", uid, user, ... }
export function connectLive(onEvent) {
  const conn = $("conn");
  const normalize = (msg) => {
    if (!msg || typeof msg !== "object") return null;
    const user = msg.user || {};
    const uid = String(user.uid || "");
    switch (msg.type) {
      case "gift": return {
        kind: "gift", uid, user,
        diamonds: Math.max(1, Number(msg.diamonds) || 1),
        name: msg.gift_name || "Hediye",
        id: Number(msg.gift_id) || 0,
        rose: isRose(msg),
        gift: giftKey(msg.gift_id, msg.gift_name, msg.diamond_unit || msg.diamonds),
        repeat: Math.max(1, Number(msg.repeat_count) || 1),
      };
      case "like": return { kind: "like", uid, user, count: Math.max(1, Number(msg.count) || 1) };
      case "chat": return { kind: "chat", uid, user, text: String(msg.raw_text || msg.text || "") };
      case "live_feed":
        if (msg.kind === "follow" || msg.kind === "share") return { kind: msg.kind, uid, user };
        return null;
      case "reload_overlay": location.reload(); return null;
      default: return null;
    }
  };
  const open = () => {
    const proto = location.protocol === "https:" ? "wss:" : "ws:";
    let ws;
    try { ws = new WebSocket(`${proto}//${location.host}/ws`); } catch { setTimeout(open, 3000); return; }
    ws.onopen = () => { if (conn) { conn.textContent = "● bağlı"; conn.style.color = "#7cff6b"; } };
    ws.onmessage = (ev) => {
      try { const e = normalize(JSON.parse(ev.data)); if (e && e.uid) onEvent(e); } catch (err) { console.warn(err); }
    };
    ws.onclose = () => { if (conn) { conn.textContent = "● bağlantı yok"; conn.style.color = "#ff6b6b"; } setTimeout(open, 2500); };
    ws.onerror = () => ws.close();
  };
  if (location.host) open();
}

// Avatar resmi (aynı origin proxy tercih edilir) — yüklenince img döner, yoksa null kalır.
export function loadAvatar(user, cb) {
  const src = (user && (user.proxy_avatar || user.avatar)) || "";
  if (!src) return;
  const img = new Image();
  if (!src.startsWith("/")) img.crossOrigin = "anonymous";
  img.onload = () => cb(img);
  img.src = src;
}

// Demo / klavye testi: 1 gül(yeni), 2 TikTok, 3 GG, 4 dondurma, 5 parmak kalp, 6 donut, 7 beğeni, 8 yorum
const DEMO_NAMES = ["Azad_21", "Zeynep_K", "Baran_47", "Elif_Su", "Mert_Can", "Dilan_65", "Kerem_06", "Berfin_34", "Emre_TS", "Buse_Nur", "Hamambocegi", "Halaybasi"];
export function setupDemo(onEvent, listPlayers, { newRate = 0.08, maxNew = 16 } = {}) {
  let idx = 0;
  const pick = (existing) => {
    const arr = listPlayers();
    if (existing && arr.length) { const p = arr[Math.floor(Math.random() * arr.length)]; return { uid: p.uid, nickname: p.nickname }; }
    idx++;
    return { uid: `demo_${idx}`, nickname: `${DEMO_NAMES[idx % DEMO_NAMES.length]}${idx > DEMO_NAMES.length ? "_" + idx : ""}` };
  };
  const acts = {
    "1": () => onEvent(gift(pick(false), "rose", 1)),
    "2": () => onEvent(gift(pick(true), "tiktok", 1)),
    "3": () => onEvent(gift(pick(true), "gg", 1)),
    "4": () => onEvent(gift(pick(true), "icecream", 1)),
    "5": () => onEvent(gift(pick(true), "heart", 5)),
    "6": () => onEvent(gift(pick(true), "donut", 30)),
    "7": () => onEvent({ kind: "like", ...wrap(pick(true)), count: 3 + Math.floor(Math.random() * 15) }),
    "8": () => onEvent({ kind: "chat", ...wrap(pick(true)), text: Math.random() < 0.5 ? "1" : "2" }),
  };
  function gift(u, key, dia) { return { kind: "gift", ...wrap(u), diamonds: dia, name: GIFTS[key].label, id: GIFTS[key].id, rose: key === "rose", gift: key, repeat: 1 }; }
  function wrap(u) { return { uid: u.uid, user: u }; }
  window.addEventListener("keydown", (e) => acts[e.key]?.());
  if (DEMO) {
    for (let i = 0; i < 6; i++) setTimeout(acts["1"], 300 + i * 450);
    setInterval(() => {
      const r = Math.random();
      if (r < newRate && listPlayers().length < maxNew) acts["1"]();
      else if (r < 0.14) acts["2"]();
      else if (r < 0.19) acts["3"]();
      else if (r < 0.23) acts["4"]();
      else if (r < 0.27) acts["5"]();
      else if (r < 0.29) acts["6"]();
      else if (r < 0.34) acts["8"]();
      else acts["7"]();
    }, 900);
  }
  return acts;
}

// 2D kamera: hedefe yumuşak kayma + zoom + sarsıntı
export class Cam2D {
  constructor() { this.x = 0; this.y = 0; this.z = 1; this.tx = 0; this.ty = 0; this.tz = 1; this.shake = 0; }
  update(dt, rate = 3) {
    const k = 1 - Math.exp(-dt * rate);
    this.x += (this.tx - this.x) * k; this.y += (this.ty - this.y) * k; this.z += (this.tz - this.z) * k;
    this.shake = Math.max(0, this.shake - dt * 1.5);
  }
  apply(g, w, h) {
    const sx = (Math.random() - 0.5) * this.shake * 18, sy = (Math.random() - 0.5) * this.shake * 18;
    g.setTransform(this.z, 0, 0, this.z, w / 2 - this.x * this.z + sx, h / 2 - this.y * this.z + sy);
  }
}

export function setupCanvas(canvas, dprCap = 2) {
  const g = canvas.getContext("2d");
  const fit = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, dprCap);
    canvas.width = Math.round(window.innerWidth * dpr);
    canvas.height = Math.round(window.innerHeight * dpr);
  };
  window.addEventListener("resize", fit);
  fit();
  return g;
}
