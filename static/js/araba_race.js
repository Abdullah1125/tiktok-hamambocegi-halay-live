// Araba Yarışı — TikTok LIVE etkileşimli yarış oyunu.
// 🌹 Gül (veya herhangi bir hediye) → izleyici yarışa arabasıyla katılır.
// ❤️ Beğeni / 💬 yorum / ➕ takip / 🔄 paylaşım → hız; 🎁 hediye → NİTRO.
// Kamera, hızlanan / yeni katılan izleyicinin arabasına doğru gider.
import * as THREE from "three";

const PARAMS = new URLSearchParams(location.search);
const IS_OBS = PARAMS.get("obs") === "1";
const DEMO = PARAMS.get("demo") === "1";
if (IS_OBS) document.body.classList.add("obs");

// ---------- Oyun ayarları ----------
const TRACK_LEN = Number(PARAMS.get("mesafe")) || 1200; // metre
const LANES = 8;
const LANE_W = 3.2;
const ROAD_W = LANES * LANE_W + 4;
const MAX_RACERS = 40;
const BASE_SPEED = 14; // m/s
const BOOST_DECAY_SEC = 2.6;
const MAX_BOOST = 70;
const COUNTDOWN_SEC = 5;
const FINISH_SHOW_SEC = 7;
const IDLE_DROP_SEC = 600; // 10 dk etkileşimsiz yarışçı tur sonunda çıkarılır

const PALETTE = [0xff3d7f, 0x33e1ff, 0xffd54a, 0x7cff6b, 0xb36bff, 0xff8a3d, 0xffffff, 0x3d7bff, 0xff4040, 0x00d9a3, 0xffb3d9, 0x9a6b3d];

// ---------- Renderer / sahne ----------
const canvas = document.getElementById("scene");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87b8ff);
scene.fog = new THREE.Fog(0x9cc4ff, 60, 260);

const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 800);
camera.position.set(0, 12, 22);

scene.add(new THREE.HemisphereLight(0xdfefff, 0x3a5a2a, 0.9));
const sun = new THREE.DirectionalLight(0xfff2d6, 1.6);
sun.position.set(30, 60, 20);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 1, far: 160 });
scene.add(sun, sun.target);

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  // Dikey (9:16) ekranda yolu daha geniş göster
  camera.fov = w / h < 0.8 ? 70 : 58;
  camera.updateProjectionMatrix();
}
window.addEventListener("resize", resize);
resize();

// ---------- Dünya ----------
function canvasTex(w, h, draw, repeat) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  t.anisotropy = 8;
  return t;
}

const WORLD_LEN = TRACK_LEN + 400;
// Zemin
const grass = new THREE.Mesh(
  new THREE.PlaneGeometry(600, WORLD_LEN + 400),
  new THREE.MeshStandardMaterial({
    map: canvasTex(128, 128, (g, w, h) => {
      g.fillStyle = "#4f9a3a"; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 900; i++) { g.fillStyle = Math.random() < 0.5 ? "#5aa844" : "#3f8a30"; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
    }, [60, 200]),
    roughness: 1,
  })
);
grass.rotation.x = -Math.PI / 2;
grass.position.set(0, -0.02, -WORLD_LEN / 2 + 150);
grass.receiveShadow = true;
scene.add(grass);

// Yol (asfalt + şerit çizgileri)
const roadTex = canvasTex(512, 256, (g, w, h) => {
  g.fillStyle = "#2b2d33"; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 2500; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * 0.05})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
  const edge = (2 / ROAD_W) * w;
  g.fillStyle = "#f4f4f4"; g.fillRect(edge - 6, 0, 6, h); g.fillRect(w - edge, 0, 6, h);
  g.fillStyle = "#e8e8e8";
  for (let l = 1; l < LANES; l++) {
    const x = edge + (l * (w - edge * 2)) / LANES;
    g.fillRect(x - 2, 0, 4, h * 0.5);
  }
}, [1, WORLD_LEN / 12]);
roadTex.rotation = 0;
const road = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_W, WORLD_LEN), new THREE.MeshStandardMaterial({ map: roadTex, roughness: 0.85 }));
road.rotation.x = -Math.PI / 2;
road.position.set(0, 0, -WORLD_LEN / 2 + 150);
road.receiveShadow = true;
scene.add(road);

// Bordürler (kırmızı-beyaz)
const curbTex = canvasTex(64, 64, (g, w, h) => { g.fillStyle = "#e33"; g.fillRect(0, 0, w, h / 2); g.fillStyle = "#fff"; g.fillRect(0, h / 2, w, h / 2); }, [1, WORLD_LEN / 4]);
for (const s of [-1, 1]) {
  const curb = new THREE.Mesh(new THREE.BoxGeometry(1, 0.25, WORLD_LEN), new THREE.MeshStandardMaterial({ map: curbTex }));
  curb.position.set(s * (ROAD_W / 2 + 0.5), 0.12, -WORLD_LEN / 2 + 150);
  scene.add(curb);
}

// Ağaçlar (instanced)
{
  const n = Math.floor(WORLD_LEN / 9) * 2;
  const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.25, 0.35, 2, 6), new THREE.MeshStandardMaterial({ color: 0x6b4423 }), n);
  const crown = new THREE.InstancedMesh(new THREE.ConeGeometry(1.8, 4.5, 8), new THREE.MeshStandardMaterial({ color: 0x2f7d32, flatShading: true }), n);
  trunk.castShadow = crown.castShadow = true;
  const m = new THREE.Matrix4();
  let i = 0;
  for (let z = 140; z > -WORLD_LEN + 150 && i < n; z -= 9) {
    for (const s of [-1, 1]) {
      if (i >= n) break;
      const x = s * (ROAD_W / 2 + 5 + Math.random() * 14);
      const zz = z + (Math.random() - 0.5) * 6;
      const sc = 0.8 + Math.random() * 0.7;
      m.compose(new THREE.Vector3(x, 1 * sc, zz), new THREE.Quaternion(), new THREE.Vector3(sc, sc, sc));
      trunk.setMatrixAt(i, m);
      m.compose(new THREE.Vector3(x, 4 * sc, zz), new THREE.Quaternion(), new THREE.Vector3(sc, sc, sc));
      crown.setMatrixAt(i, m);
      crown.setColorAt(i, new THREE.Color().setHSL(0.28 + Math.random() * 0.08, 0.55, 0.28 + Math.random() * 0.12));
      i++;
    }
  }
  trunk.count = crown.count = i;
  scene.add(trunk, crown);
}

// Mesafe tabelaları
function textSprite(text, { size = 64, color = "#fff", bg = "rgba(0,0,0,.55)", w = 512, h = 128 } = {}) {
  const tex = canvasTex(w, h, (g) => {
    g.fillStyle = bg; roundRect(g, 0, 0, w, h, 24); g.fill();
    g.font = `900 ${size}px Segoe UI, sans-serif`; g.fillStyle = color; g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText(text, w / 2, h / 2 + 4);
  });
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false }));
  sp.scale.set(w / 64, h / 64, 1);
  return sp;
}
for (let d = 100; d < TRACK_LEN; d += 100) {
  for (const s of [-1, 1]) {
    const sp = textSprite(`${TRACK_LEN - d} m`, { size: 70, color: "#ffd54a" });
    sp.position.set(s * (ROAD_W / 2 + 3), 3, -d);
    scene.add(sp);
  }
}

// Başlangıç ve bitiş kapıları
function gate(z, label, checker) {
  const g = new THREE.Group();
  const postMat = new THREE.MeshStandardMaterial({ color: 0xdddddd, metalness: 0.4, roughness: 0.4 });
  for (const s of [-1, 1]) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.8, 8, 0.8), postMat);
    p.position.set(s * (ROAD_W / 2 + 1), 4, 0); p.castShadow = true; g.add(p);
  }
  const bannerTex = canvasTex(1024, 128, (c, w, h) => {
    if (checker) { const sq = 32; for (let x = 0; x < w; x += sq) for (let y = 0; y < h; y += sq) { c.fillStyle = ((x + y) / sq) % 2 ? "#111" : "#fff"; c.fillRect(x, y, sq, sq); } }
    else { c.fillStyle = "#ff3d7f"; c.fillRect(0, 0, w, h); }
    c.fillStyle = checker ? "rgba(0,0,0,.7)" : "rgba(0,0,0,.25)"; c.fillRect(w * 0.25, 10, w * 0.5, h - 20);
    c.font = "900 84px Segoe UI, sans-serif"; c.fillStyle = "#ffd54a"; c.textAlign = "center"; c.textBaseline = "middle";
    c.fillText(label, w / 2, h / 2 + 4);
  });
  const banner = new THREE.Mesh(new THREE.BoxGeometry(ROAD_W + 2.8, 1.8, 0.3), new THREE.MeshStandardMaterial({ map: bannerTex }));
  banner.position.y = 7.4; g.add(banner);
  if (checker) {
    const lineTex = canvasTex(256, 32, (c, w, h) => { const sq = 16; for (let x = 0; x < w; x += sq) for (let y = 0; y < h; y += sq) { c.fillStyle = ((x + y) / sq) % 2 ? "#111" : "#fff"; c.fillRect(x, y, sq, sq); } });
    const line = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_W, 2), new THREE.MeshStandardMaterial({ map: lineTex }));
    line.rotation.x = -Math.PI / 2; line.position.y = 0.02; g.add(line);
  }
  g.position.z = z;
  scene.add(g);
  return g;
}
gate(2, "START", false);
gate(-TRACK_LEN, "🏁 BİTİŞ 🏁", true);

// ---------- Arabalar ----------
const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.35, 14);
wheelGeo.rotateZ(Math.PI / 2);
const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.7 });
const glassMat = new THREE.MeshStandardMaterial({ color: 0x1a2a3a, metalness: 0.6, roughness: 0.15 });
const lightMat = new THREE.MeshStandardMaterial({ color: 0xffffee, emissive: 0xffffcc, emissiveIntensity: 1.2 });
const tailMat = new THREE.MeshStandardMaterial({ color: 0xff2222, emissive: 0xff0000, emissiveIntensity: 0.8 });
const flameMat = new THREE.MeshBasicMaterial({ color: 0x66ddff, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
const flameGeo = new THREE.ConeGeometry(0.32, 2.2, 10, 1, true);
flameGeo.rotateX(-Math.PI / 2);
flameGeo.translate(0, 0, 1.1);
const bodyMats = new Map();
function bodyMat(color) {
  if (!bodyMats.has(color)) bodyMats.set(color, new THREE.MeshStandardMaterial({ color, metalness: 0.55, roughness: 0.3 }));
  return bodyMats.get(color);
}

function buildCar(color) {
  const car = new THREE.Group();
  const mat = bodyMat(color);
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.55, 4), mat);
  body.position.y = 0.6; body.castShadow = true; car.add(body);
  const nose = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.3, 1), mat);
  nose.position.set(0, 0.45, -2.3); car.add(nose);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.5, 1.8), glassMat);
  cabin.position.set(0, 1.1, 0.2); cabin.castShadow = true; car.add(cabin);
  const spoiler = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.12, 0.5), mat);
  spoiler.position.set(0, 1.15, 1.85); car.add(spoiler);
  for (const s of [-1, 1]) {
    const st = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.35, 0.1), mat);
    st.position.set(s * 0.7, 0.95, 1.85); car.add(st);
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.15, 0.05), lightMat);
    hl.position.set(s * 0.6, 0.6, -2.81); car.add(hl);
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.15, 0.05), tailMat);
    tl.position.set(s * 0.6, 0.65, 2.01); car.add(tl);
  }
  const wheels = [];
  for (const [x, z] of [[-1, -1.35], [1, -1.35], [-1, 1.35], [1, 1.35]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.position.set(x, 0.42, z); w.castShadow = true; car.add(w); wheels.push(w);
  }
  const flames = [];
  for (const s of [-1, 1]) {
    const f = new THREE.Mesh(flameGeo, flameMat);
    f.position.set(s * 0.5, 0.55, 2.0); f.visible = false; car.add(f); flames.push(f);
  }
  scene.add(car);
  return { car, wheels, flames };
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

function makeLabel(racer) {
  const c = document.createElement("canvas");
  c.width = 512; c.height = 128;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const draw = (img) => {
    const g = c.getContext("2d");
    g.clearRect(0, 0, 512, 128);
    g.fillStyle = "rgba(10,12,24,.72)"; roundRect(g, 4, 14, 504, 100, 50); g.fill();
    g.lineWidth = 6; g.strokeStyle = "#" + racer.color.toString(16).padStart(6, "0"); g.stroke();
    g.save(); g.beginPath(); g.arc(64, 64, 42, 0, Math.PI * 2); g.clip();
    if (img) g.drawImage(img, 22, 22, 84, 84);
    else { g.fillStyle = g.strokeStyle; g.fillRect(22, 22, 84, 84); g.fillStyle = "#111"; g.font = "900 52px Segoe UI"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText((racer.nickname[0] || "?").toUpperCase(), 64, 68); }
    g.restore();
    g.font = "800 48px Segoe UI, sans-serif"; g.fillStyle = "#fff"; g.textAlign = "left"; g.textBaseline = "middle";
    let nm = racer.nickname;
    while (g.measureText(nm).width > 370 && nm.length > 3) nm = nm.slice(0, -2);
    if (nm !== racer.nickname) nm += "…";
    g.fillText(nm, 120, 66);
    tex.needsUpdate = true;
  };
  draw(null);
  const src = racer.avatar;
  if (src) {
    const img = new Image();
    if (!src.startsWith("/")) img.crossOrigin = "anonymous";
    img.onload = () => { try { draw(img); } catch { draw(null); } };
    img.src = src;
  }
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, depthWrite: false }));
  sp.scale.set(4.4, 1.1, 1);
  sp.position.y = 2.9;
  sp.renderOrder = 10;
  return sp;
}

// ---------- Oyun durumu ----------
const racers = new Map(); // uid -> racer
const wins = new Map(); // uid -> tur kazanma
let phase = "idle"; // idle | countdown | race | finish
let phaseT = 0;
let round = 1;
let winner = null;
let focus = null; // { uid, until, strength }
let shake = 0;
let colorCounter = 0;

function laneX(lane) { return -ROAD_W / 2 + 2 + LANE_W * (lane + 0.5); }

function nextLane() {
  const counts = new Array(LANES).fill(0);
  for (const r of racers.values()) counts[r.lane]++;
  let best = 0;
  for (let i = 1; i < LANES; i++) if (counts[i] < counts[best]) best = i;
  return best;
}

function addRacer(user, via) {
  const uid = String(user.uid || user.nickname || Math.random());
  if (racers.has(uid)) return racers.get(uid);
  if (racers.size >= MAX_RACERS) {
    // En geride ve en uzun süredir sessiz olanı çıkar
    let worst = null;
    for (const r of racers.values()) if (!worst || r.lastActive < worst.lastActive) worst = r;
    if (worst) removeRacer(worst.uid);
  }
  const color = PALETTE[colorCounter++ % PALETTE.length];
  const racer = {
    uid,
    nickname: String(user.nickname || uid).slice(0, 24),
    avatar: user.proxy_avatar || user.avatar || "",
    color,
    lane: nextLane(),
    // Yarış ortasında katılan en arkadakinin biraz gerisinden başlar
    dist: phase === "race" && racers.size ? Math.max(0, Math.min(...[...racers.values()].map((r) => r.dist)) * 0.8) : 0,
    boost: 0,
    temper: 0.96 + Math.random() * 0.08,
    wobble: Math.random() * 100,
    finishedAt: 0,
    lastActive: performance.now() / 1000,
  };
  Object.assign(racer, buildCar(color));
  racer.label = makeLabel(racer);
  racer.car.add(racer.label);
  racer.car.position.set(laneX(racer.lane), 0, -racer.dist);
  racers.set(uid, racer);
  toast(`🌹 <b>${esc(racer.nickname)}</b> ${via === "gift" ? "hediyeyle" : "gülle"} yarışa katıldı!`, "join");
  setFocus(uid, 3.2, 1);
  if (phase === "idle") startCountdown();
  return racer;
}

function removeRacer(uid) {
  const r = racers.get(uid);
  if (!r) return;
  scene.remove(r.car);
  r.label.material.map.dispose();
  r.label.material.dispose();
  racers.delete(uid);
  if (focus && focus.uid === uid) focus = null;
}

function boost(uid, amount, { nitro = false, focusSec = 0, prio = 0 } = {}) {
  const r = racers.get(uid);
  if (!r) return null;
  r.boost = Math.min(MAX_BOOST, r.boost + amount);
  r.lastActive = performance.now() / 1000;
  if (nitro) r.nitroUntil = performance.now() / 1000 + Math.min(6, 1.5 + amount / 10);
  if (focusSec > 0) setFocus(uid, focusSec, prio);
  return r;
}

function setFocus(uid, sec, prio) {
  const now = performance.now() / 1000;
  if (focus && focus.until > now && focus.prio > prio && focus.uid !== uid) return;
  focus = { uid, until: now + sec, prio };
}

function startCountdown() { phase = "countdown"; phaseT = COUNTDOWN_SEC; }

function resetRound() {
  const now = performance.now() / 1000;
  for (const r of [...racers.values()]) if (now - r.lastActive > IDLE_DROP_SEC) removeRacer(r.uid);
  for (const r of racers.values()) { r.dist = 0; r.boost = 0; r.finishedAt = 0; r.nitroUntil = 0; }
  winner = null;
  round++;
  if (racers.size) startCountdown(); else phase = "idle";
}

// ---------- HUD ----------
const $ = (id) => document.getElementById(id);
function esc(s) { return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]); }
function toast(html, kind = "") {
  const el = document.createElement("div");
  el.className = `toast ${kind}`;
  el.innerHTML = html;
  const feed = $("feed");
  feed.prepend(el);
  while (feed.children.length > 5) feed.lastChild.remove();
  setTimeout(() => el.remove(), 5000);
}
function center(msg, sub = "") { $("center").innerHTML = msg ? `<div class="msg">${msg}</div>${sub ? `<div class="sub">${sub}</div>` : ""}` : ""; }

let lastCenterKey = "";
function updateHud() {
  const sorted = ranking();
  $("racerCount").textContent = `${racers.size} 🏎️`;
  $("rows").innerHTML = sorted.slice(0, 8).map((r, i) => {
    const kmh = Math.round(currentSpeed(r) * 3.6 * (phase === "race" ? 1 : 0));
    const pct = Math.min(100, (r.dist / TRACK_LEN) * 100);
    const w = wins.get(r.uid) || 0;
    return `<div class="row"><span class="pos">${["🥇", "🥈", "🥉"][i] || i + 1}</span><span class="sw" style="background:#${r.color.toString(16).padStart(6, "0")}"></span>
      <div class="nm">${esc(r.nickname)}${w ? ` <small style="color:#ffd54a">🏆${w}</small>` : ""}<div class="bar"><i style="width:${pct}%"></i></div></div><span class="kmh">${kmh} km/sa</span></div>`;
  }).join("") || `<div class="row" style="opacity:.8">🌹 Gül at, ilk sen katıl!</div>`;

  const leader = sorted[0];
  if (phase === "idle") { $("lapTxt").textContent = "BEKLENİYOR"; $("lapSub").textContent = "İlk gülü at, yarış başlasın!"; }
  else if (phase === "countdown") { $("lapTxt").textContent = `TUR ${round}`; $("lapSub").textContent = "Katılmak için 🌹 gül at!"; }
  else if (phase === "race") { $("lapTxt").textContent = `TUR ${round}`; $("lapSub").textContent = leader ? `Kalan: ${Math.max(0, Math.ceil(TRACK_LEN - leader.dist))} m` : ""; }
  else { $("lapTxt").textContent = "🏁 BİTTİ"; $("lapSub").textContent = `Yeni tur ${Math.ceil(phaseT)} sn`; }

  let key = "";
  if (phase === "countdown") {
    const n = Math.ceil(phaseT);
    key = `cd${n}`;
    if (key !== lastCenterKey) center(n <= 3 ? String(n) : "HAZIRLAN!", n <= 3 ? "" : `${racers.size} yarışçı hazır • 🌹 gül at katıl`);
  } else if (phase === "race" && phaseT > -1.2) {
    key = "go"; if (key !== lastCenterKey) center("BAŞLA! 🚦");
  } else if (phase === "finish" && winner) {
    key = `win${round}`; if (key !== lastCenterKey) center(`🏆 ${esc(winner.nickname)}`, `KAZANDI! (toplam ${wins.get(winner.uid) || 1} galibiyet)`);
  } else { key = ""; if (key !== lastCenterKey) center(""); }
  lastCenterKey = key;

  const now = performance.now() / 1000;
  const f = focus && focus.until > now ? racers.get(focus.uid) : null;
  $("focus").innerHTML = f && phase !== "finish" ? `<span>🎥 ${esc(f.nickname)} ${f.nitroUntil > now ? "NİTRO! 🔥" : "hızlanıyor! ⚡"}</span>` : "";
}

function ranking() {
  return [...racers.values()].sort((a, b) => {
    if (a.finishedAt && b.finishedAt) return a.finishedAt - b.finishedAt;
    if (a.finishedAt) return -1;
    if (b.finishedAt) return 1;
    return b.dist - a.dist;
  });
}

function currentSpeed(r) {
  return BASE_SPEED * r.temper + r.boost + Math.sin(r.wobble) * 0.8;
}

// ---------- Canlı yayın olayları ----------
const chatCooldown = new Map();
function isRose(msg) {
  const n = String(msg.gift_name || "").toLowerCase();
  return Number(msg.gift_id) === 5655 || /gül|gul|rose|rosa|роза/.test(n);
}

function handleEvent(msg) {
  if (!msg || typeof msg !== "object") return;
  const u = msg.user || {};
  const uid = String(u.uid || "");
  switch (msg.type) {
    case "gift": {
      const dia = Math.max(1, Number(msg.diamonds) || 1);
      const name = esc(msg.gift_name || "Hediye");
      if (!racers.has(uid)) {
        addRacer(u, isRose(msg) ? "rose" : "gift");
        if (isRose(msg) && dia <= 1) return;
      }
      const amt = 4 + Math.sqrt(dia) * 4;
      const big = dia >= 5;
      boost(uid, amt, { nitro: big || !isRose(msg), focusSec: big ? 4.5 : 3, prio: big ? 3 : 2 });
      if (dia >= 99) shake = 1;
      toast(`🎁 <b>${esc(u.nickname || uid)}</b> ${name}${(msg.repeat_count || 1) > 1 ? ` x${msg.repeat_count}` : ""} → ${big ? "NİTRO 🔥" : "hız ⚡"}`, "nitro");
      break;
    }
    case "like": {
      if (!racers.has(uid)) return;
      const c = Math.max(1, Number(msg.count) || 1);
      boost(uid, Math.min(8, 0.6 + c * 0.3), { focusSec: c >= 5 ? 2.2 : 0, prio: 1 });
      if (c >= 10) toast(`❤️ <b>${esc(u.nickname || uid)}</b> ${c} beğeni → hızlandı!`, "like");
      break;
    }
    case "chat": {
      const txt = String(msg.raw_text || msg.text || "");
      if (!racers.has(uid)) {
        if (/kat[ıi]l|yar[ıi][sş]|join|araba/i.test(txt)) toast(`🌹 <b>${esc(u.nickname || uid)}</b>, katılmak için <b>Gül</b> at!`);
        return;
      }
      const now = performance.now();
      if (now - (chatCooldown.get(uid) || 0) < 1200) return;
      chatCooldown.set(uid, now);
      boost(uid, 2, { focusSec: 1.6, prio: 0 });
      break;
    }
    case "live_feed": {
      if (msg.kind === "follow") { if (boost(uid, 6, { focusSec: 2.5, prio: 1 })) toast(`➕ <b>${esc(u.nickname || uid)}</b> takip etti → hız!`); }
      else if (msg.kind === "share") { if (boost(uid, 8, { nitro: true, focusSec: 2.5, prio: 1 })) toast(`🔄 <b>${esc(u.nickname || uid)}</b> paylaştı → NİTRO!`, "nitro"); }
      break;
    }
    case "reload_overlay": location.reload(); break;
  }
}

// WebSocket bağlantısı (halay ile aynı köprü)
function connect() {
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  let ws;
  try { ws = new WebSocket(`${proto}//${location.host}/ws`); } catch { setTimeout(connect, 3000); return; }
  ws.onopen = () => { $("conn").textContent = "● bağlı"; $("conn").style.color = "#7cff6b"; };
  ws.onmessage = (ev) => { try { handleEvent(JSON.parse(ev.data)); } catch (e) { console.warn(e); } };
  ws.onclose = () => { $("conn").textContent = "● bağlantı yok"; $("conn").style.color = "#ff6b6b"; setTimeout(connect, 2500); };
  ws.onerror = () => ws.close();
}
if (location.host) connect();

// Test / demo: ?demo=1 ya da klavye (1: gül, 2: hediye, 3: beğeni, 4: büyük hediye)
const DEMO_NAMES = ["Azad_21", "Zeynep_K", "Baran_47", "Elif_Su", "Mert_Can", "Dilan_65", "Kerem_06", "Berfin_34", "Emre_TS", "Buse_Nur", "Hamambocegi", "Halaybasi"];
let demoIdx = 0;
function demoUser(existing) {
  if (existing && racers.size) { const arr = [...racers.values()]; const r = arr[Math.floor(Math.random() * arr.length)]; return { uid: r.uid, nickname: r.nickname }; }
  demoIdx++;
  return { uid: `demo_${demoIdx}`, nickname: `${DEMO_NAMES[demoIdx % DEMO_NAMES.length]}${demoIdx > DEMO_NAMES.length ? "_" + demoIdx : ""}` };
}
const demoActions = {
  "1": () => handleEvent({ type: "gift", user: demoUser(false), gift_id: 5655, gift_name: "Rose", diamonds: 1 }),
  "2": () => handleEvent({ type: "gift", user: demoUser(true), gift_id: 5879, gift_name: "Donut", diamonds: 30 }),
  "3": () => handleEvent({ type: "like", user: demoUser(true), count: 3 + Math.floor(Math.random() * 15) }),
  "4": () => handleEvent({ type: "gift", user: demoUser(true), gift_id: 5502, gift_name: "Kraliyet Tacı", diamonds: 199 }),
};
window.addEventListener("keydown", (e) => demoActions[e.key]?.());
window.arabaYarisi = { handleEvent, racers };
if (DEMO) {
  for (let i = 0; i < 6; i++) setTimeout(demoActions["1"], 300 + i * 500);
  setInterval(() => {
    const r = Math.random();
    if (r < 0.08 && racers.size < 16) demoActions["1"]();
    else if (r < 0.2) demoActions["2"]();
    else if (r < 0.23) demoActions["4"]();
    else demoActions["3"]();
  }, 900);
}

// ---------- Döngü ----------
const clock = new THREE.Clock();
const camPos = new THREE.Vector3(0, 14, 26);
const camLook = new THREE.Vector3(0, 0, -10);
const tmpV = new THREE.Vector3();
const camRel = new THREE.Vector3(0, 9, 18);
const camOff = new THREE.Vector3();
let camFollowX = 0, camFollowZ = 0, camPrevZ = 0, camTargetUid = "";
let hudT = 0;
let idleAng = 0;

function tick() {
  const dt = Math.min(0.05, clock.getDelta());
  const now = performance.now() / 1000;

  if (phase === "countdown") { phaseT -= dt; if (phaseT <= 0) { phase = "race"; phaseT = 0; } }
  else if (phase === "race") { phaseT -= dt; }
  else if (phase === "finish") { phaseT -= dt; if (phaseT <= 0) resetRound(); }

  for (const r of racers.values()) {
    r.wobble += dt * 0.7;
    r.boost *= Math.exp(-dt / BOOST_DECAY_SEC);
    let v = 0;
    if (phase === "race" && !r.finishedAt) {
      v = currentSpeed(r);
      r.dist += v * dt;
      if (r.dist >= TRACK_LEN) {
        r.dist = TRACK_LEN;
        r.finishedAt = now;
        if (!winner) {
          winner = r;
          wins.set(r.uid, (wins.get(r.uid) || 0) + 1);
          phase = "finish";
          phaseT = FINISH_SHOW_SEC;
          setFocus(r.uid, FINISH_SHOW_SEC, 9);
          toast(`🏆 <b>${esc(r.nickname)}</b> ${round}. turu kazandı!`, "nitro");
        }
      }
    } else if (phase === "finish" && !r.finishedAt) {
      v = currentSpeed(r) * 0.5; // bitişten sonra yavaşça devam
      r.dist = Math.min(TRACK_LEN - 0.5, r.dist + v * dt);
    }
    const x = laneX(r.lane) + Math.sin(r.wobble * 1.3) * 0.25;
    r.car.position.set(x, 0, -r.dist);
    r.car.rotation.z = Math.sin(now * 20) * 0.004 * Math.min(1, r.boost / 10);
    r.car.rotation.x = -Math.min(0.06, r.boost * 0.0015);
    for (const w of r.wheels) w.rotation.x -= (v / 0.42) * dt;
    const nitroOn = (r.nitroUntil || 0) > now && phase !== "idle";
    for (const f of r.flames) { f.visible = nitroOn; if (nitroOn) f.scale.set(1, 1, 0.7 + Math.random() * 0.8); }
  }

  // Kamera: odaktaki arabaya (hızlanan / yeni katılan) ya da lidere doğru gider
  let target = focus && focus.until > now ? racers.get(focus.uid) : null;
  const focused = !!target;
  if (!target) target = ranking()[0];
  if (phase === "idle" || !target) {
    idleAng += dt * 0.15;
    tmpV.set(Math.sin(idleAng) * 22, 12, 18 + Math.cos(idleAng) * 10);
    camPos.lerp(tmpV, 1 - Math.exp(-dt * 1.5));
    camLook.lerp(tmpV.set(0, 1, -6), 1 - Math.exp(-dt * 2));
  } else {
    // Hedef değişince kamera yumuşakça kayar; hızlı arabada geride kalmaması için z ekseninde hedefi birebir takip eder.
    const p = target.car.position;
    const speedK = Math.min(1, target.boost / 30);
    if (focused) camOff.set(3.2, 3.2 + speedK, 8.5 + speedK * 2);
    else if (phase === "countdown") camOff.set(-p.x * 0.7, 7, 16);
    else camOff.set(-p.x * 0.6, 9, 18);
    const k = 1 - Math.exp(-dt * (focused ? 3 : 2));
    camRel.lerp(camOff, k);
    camFollowX += (p.x - camFollowX) * k;
    // Aynı hedefte: arabanın hareketini birebir taşı (geride kalmaz); yeni hedefe yumuşak geçiş
    if (camTargetUid === target.uid) camFollowZ += p.z - camPrevZ;
    camFollowZ += (p.z - camFollowZ) * (1 - Math.exp(-dt * 2.5));
    camTargetUid = target.uid;
    camPrevZ = p.z;
    camPos.set(camFollowX + camRel.x, camRel.y, camFollowZ + camRel.z);
    camLook.set(camFollowX, 1, camFollowZ - 6);
    camera.fov += ((window.innerWidth / window.innerHeight < 0.8 ? 70 : 58) + speedK * 12 - camera.fov) * (1 - Math.exp(-dt * 3));
    camera.updateProjectionMatrix();
  }
  camera.position.copy(camPos);
  if (shake > 0) { camera.position.x += (Math.random() - 0.5) * shake; camera.position.y += (Math.random() - 0.5) * shake; shake = Math.max(0, shake - dt * 1.2); }
  camera.lookAt(camLook);

  // Gölgeler kamerayla birlikte gelsin
  sun.position.set(camLook.x + 30, 60, camLook.z + 20);
  sun.target.position.copy(camLook);

  hudT -= dt;
  if (hudT <= 0) { hudT = 0.2; updateHud(); }

  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
updateHud();
tick();
