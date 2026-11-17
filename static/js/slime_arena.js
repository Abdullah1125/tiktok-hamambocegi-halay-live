// Slime Arena — TikTok LIVE etkileşimli oyun.
// 🌹 Gül → slime olarak arenaya katıl. Büyük slime küçüğü yutar, süre sonunda en büyük kazanır.
// Hediyeler: 🎵 TikTok = DASH, 🎮 GG = şok dalgası, 🍦 Dondurma = yakındakileri dondur,
// 🫰 Parmak kalp = kalkan, 🍩 Donut = MEGA büyüme. ❤️ Beğeni = büyü, 💬 yorum = minik hız.
import { $, esc, toast, nick, connectLive, setupDemo, loadAvatar, renderGiftLegend, Cam2D, setupCanvas, PARAMS } from "./live_common.js?v=1";

const R = 1300; // arena yarıçapı
const FOOD_N = 520;
const START_MASS = 10;
const ROUND_SEC = Number(PARAMS.get("sure")) || 180;
const END_SEC = 7;
const MAX_PLAYERS = 60;
const COLORS = ["#ff3d7f", "#33e1ff", "#ffd54a", "#7cff6b", "#b36bff", "#ff8a3d", "#3d7bff", "#ff4040", "#00d9a3", "#ffb3d9", "#c6ff3d", "#ff6bd5"];

renderGiftLegend($("legend"), [
  ["rose", "katıl / büyü"],
  ["tiktok", "DASH"],
  ["gg", "şok dalgası"],
  ["icecream", "dondur"],
  ["heart", "kalkan"],
  ["donut", "MEGA"],
]);

const canvas = $("scene");
const g = setupCanvas(canvas);
const cam = new Cam2D();
cam.tz = 0.3;

const slimes = new Map();
const wins = new Map();
const food = [];
const fx = []; // parçacık / dalga efektleri
let phase = "idle"; // idle | play | end
let timeLeft = ROUND_SEC;
let endT = 0;
let round = 1;
let winner = null;
let focus = null;
let colorIdx = 0;

const rand = (a, b) => a + Math.random() * (b - a);
const now = () => performance.now() / 1000;
const radius = (m) => 14 + Math.sqrt(m) * 6;
function randPos(margin = 80) {
  const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * (R - margin);
  return [Math.cos(a) * d, Math.sin(a) * d];
}
function spawnFood(x, y) {
  const [fx_, fy] = x === undefined ? randPos(20) : [x, y];
  food.push({ x: fx_, y: fy, c: COLORS[(Math.random() * COLORS.length) | 0], p: Math.random() * 6 });
}
for (let i = 0; i < FOOD_N; i++) spawnFood();

function addSlime(user, uid) {
  if (slimes.has(uid)) return slimes.get(uid);
  if (slimes.size >= MAX_PLAYERS) {
    let worst = null;
    for (const s of slimes.values()) if (!worst || s.lastActive < worst.lastActive) worst = s;
    if (worst) slimes.delete(worst.uid);
  }
  const [x, y] = randPos();
  const s = {
    uid, nickname: nick(user), color: COLORS[colorIdx++ % COLORS.length],
    x, y, vx: 0, vy: 0, mass: START_MASS, seed: Math.random() * 10,
    dashT: 0, shieldT: 0, frozenT: 0, deadT: 0, thinkT: 0, tx: x, ty: y,
    trail: [], img: null, lastActive: now(), eats: 0, label: "",
  };
  loadAvatar(user, (img) => { s.img = img; });
  slimes.set(uid, s);
  toast(`🌹 <b>${esc(s.nickname)}</b> slime olarak arenaya katıldı!`, "join");
  setFocus(s, 3, 1, "katıldı! 🫧");
  if (phase === "idle") { phase = "play"; timeLeft = ROUND_SEC; }
  return s;
}

function setFocus(s, sec, prio, label) {
  const t = now();
  if (focus && focus.until > t && focus.prio > prio && focus.s !== s) return;
  focus = { s, until: t + sec, prio, label };
}

function grow(s, amt) { s.mass += amt; }

// ---------- Canlı olaylar ----------
const chatCd = new Map();
function onEvent(e) {
  let s = slimes.get(e.uid);
  if (e.kind === "gift") {
    if (!s) {
      s = addSlime(e.user, e.uid);
      if (e.gift === "rose") return;
    }
    s.lastActive = now();
    const name = esc(s.nickname);
    switch (e.gift) {
      case "rose":
        grow(s, 10 * e.repeat);
        setFocus(s, 2, 1, "büyüdü! 🌹");
        break;
      case "tiktok":
        s.dashT = Math.max(s.dashT, 3 + e.repeat);
        setFocus(s, 3, 2, "DASH! 💨");
        toast(`🎵 <b>${name}</b> → DASH! 💨`, "power");
        break;
      case "gg": {
        shockwave(s);
        setFocus(s, 3, 2, "ŞOK DALGASI! 💥");
        toast(`🎮 <b>${name}</b> → ŞOK DALGASI! 💥`, "power");
        break;
      }
      case "icecream": {
        let n = 0;
        for (const o of slimes.values()) {
          if (o === s || o.deadT > 0) continue;
          if (Math.hypot(o.x - s.x, o.y - s.y) < 650 + radius(s.mass)) { o.frozenT = 4 + e.repeat; n++; }
        }
        fx.push({ type: "ring", x: s.x, y: s.y, r: radius(s.mass), max: 650 + radius(s.mass), t: 0, c: "#9fe8ff" });
        setFocus(s, 3, 2, `${n} slime dondurdu! 🍦`);
        toast(`🍦 <b>${name}</b> → ${n} slime'ı dondurdu! ❄️`, "ice");
        break;
      }
      case "heart":
        s.shieldT = Math.max(s.shieldT, 10 + e.repeat * 2);
        grow(s, 15);
        setFocus(s, 3, 2, "KALKAN! 🛡️");
        toast(`🫰 <b>${name}</b> → KALKAN! 🛡️ (yutulamaz)`, "power");
        break;
      case "donut":
        grow(s, s.mass * 0.6 + 60);
        cam.shake = 0.8;
        burst(s.x, s.y, s.color, 40);
        setFocus(s, 4.5, 3, "MEGA BÜYÜDÜ! 🍩");
        toast(`🍩 <b>${name}</b> → MEGA BÜYÜME! 🚀`, "power");
        break;
      default: {
        const amt = Math.max(8, e.diamonds * 3);
        grow(s, amt);
        if (e.diamonds >= 99) { cam.shake = 1; s.shieldT = Math.max(s.shieldT, 8); }
        setFocus(s, 4, 3, `${e.name} ile dev oldu! 🎁`);
        toast(`🎁 <b>${name}</b> ${esc(e.name)} → +${Math.round(amt)} büyüdü!`, "power");
      }
    }
    return;
  }
  if (!s) {
    if (e.kind === "chat" && /kat[ıi]l|slime|oyna|join/i.test(e.text)) toast(`🌹 <b>${esc(nick(e.user))}</b>, katılmak için <b>Gül</b> at!`);
    return;
  }
  s.lastActive = now();
  if (e.kind === "like") {
    grow(s, Math.min(12, 0.5 + e.count * 0.5));
    if (e.count >= 5) setFocus(s, 2, 1, "büyüyor! ❤️");
    if (e.count >= 12) toast(`❤️ <b>${esc(s.nickname)}</b> ${e.count} beğeni → büyüdü!`, "like");
  } else if (e.kind === "chat") {
    const t = now();
    if (t - (chatCd.get(s.uid) || 0) < 1.5) return;
    chatCd.set(s.uid, t);
    s.dashT = Math.max(s.dashT, 0.7);
  } else if (e.kind === "follow") {
    grow(s, 15); setFocus(s, 2.5, 1, "takip etti! ➕");
  } else if (e.kind === "share") {
    grow(s, 15); s.dashT = Math.max(s.dashT, 2); setFocus(s, 2.5, 1, "paylaştı! 🔄");
  }
}

function shockwave(s) {
  const rs = radius(s.mass);
  const reach = rs * 3 + 380;
  fx.push({ type: "ring", x: s.x, y: s.y, r: rs, max: reach, t: 0, c: "#ffd54a" });
  cam.shake = Math.max(cam.shake, 0.6);
  for (const o of slimes.values()) {
    if (o === s || o.deadT > 0) continue;
    const dx = o.x - s.x, dy = o.y - s.y, d = Math.hypot(dx, dy) || 1;
    if (d > reach) continue;
    const k = 900 * (1 - d / reach) + 200;
    o.vx += (dx / d) * k; o.vy += (dy / d) * k;
    if (o.mass < s.mass && !(o.shieldT > 0)) {
      const lost = o.mass * 0.15;
      o.mass -= lost;
      for (let i = 0; i < Math.min(15, lost / 2); i++) spawnFood(o.x + rand(-90, 90), o.y + rand(-90, 90));
    }
  }
}

function burst(x, y, c, n) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, sp = rand(150, 600);
    fx.push({ type: "p", x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: 0, life: rand(0.5, 1.1), c, r: rand(5, 12) });
  }
}

connectLive(onEvent);
window.slimeArena = { onEvent, slimes };
setupDemo(onEvent, () => [...slimes.values()], { newRate: 0.1, maxNew: 18 });

// ---------- Simülasyon ----------
function think(s) {
  s.thinkT = rand(0.4, 0.8);
  const rs = radius(s.mass);
  let fleeX = 0, fleeY = 0, prey = null, preyD = 1e9;
  for (const o of slimes.values()) {
    if (o === s || o.deadT > 0) continue;
    const d = Math.hypot(o.x - s.x, o.y - s.y);
    if (o.mass > s.mass * 1.25 && d < 380 + radius(o.mass) && !(s.shieldT > 0)) {
      fleeX += (s.x - o.x) / (d || 1); fleeY += (s.y - o.y) / (d || 1);
    } else if (s.mass > o.mass * 1.25 && !(o.shieldT > 0) && d < 520 + rs && d < preyD) { prey = o; preyD = d; }
  }
  if (fleeX || fleeY) { s.tx = s.x + fleeX * 500; s.ty = s.y + fleeY * 500; return; }
  if (prey && Math.random() < 0.85) { s.tx = prey.x; s.ty = prey.y; return; }
  let best = null, bd = 1e9;
  for (let i = 0; i < food.length; i += 2) {
    const f = food[(i + ((Math.random() * 2) | 0)) % food.length];
    const d = (f.x - s.x) ** 2 + (f.y - s.y) ** 2;
    if (d < bd) { bd = d; best = f; }
  }
  if (best) { s.tx = best.x; s.ty = best.y; } else { [s.tx, s.ty] = randPos(); }
}

function step(dt) {
  const t = now();
  if (phase === "play") {
    timeLeft -= dt;
    if (timeLeft <= 0) endRound();
  } else if (phase === "end") {
    endT -= dt;
    if (endT <= 0) newRound();
  }

  for (const s of slimes.values()) {
    if (s.deadT > 0) {
      s.deadT -= dt;
      if (s.deadT <= 0) { [s.x, s.y] = randPos(); s.mass = START_MASS; s.vx = s.vy = 0; s.shieldT = 2; }
      continue;
    }
    s.dashT = Math.max(0, s.dashT - dt);
    s.shieldT = Math.max(0, s.shieldT - dt);
    s.frozenT = Math.max(0, s.frozenT - dt);
    if (s.mass > 80) s.mass -= s.mass * 0.003 * dt; // dev slime yavaşça erir
    const rs = radius(s.mass);
    if ((s.thinkT -= dt) <= 0) think(s);
    let sp = Math.max(70, 330 * Math.pow(40 / rs, 0.45));
    if (s.dashT > 0) sp *= 2.6;
    if (s.frozenT > 0 || phase === "end") sp = 0;
    let dx = s.tx - s.x, dy = s.ty - s.y;
    const d = Math.hypot(dx, dy) || 1;
    const k = Math.min(1, dt * 4);
    s.vx += ((dx / d) * sp - s.vx) * k;
    s.vy += ((dy / d) * sp - s.vy) * k;
    s.x += s.vx * dt; s.y += s.vy * dt;
    const cd = Math.hypot(s.x, s.y);
    if (cd > R - rs) { s.x *= (R - rs) / cd; s.y *= (R - rs) / cd; s.vx *= 0.5; s.vy *= 0.5; s.thinkT = 0; }
    if (s.dashT > 0) { s.trail.push([s.x, s.y, t]); }
    while (s.trail.length && (t - s.trail[0][2] > 0.35 || s.trail.length > 14)) s.trail.shift();

    // Yem
    if (phase === "play") {
      for (let i = food.length - 1; i >= 0; i--) {
        const f = food[i];
        if (Math.abs(f.x - s.x) < rs && Math.abs(f.y - s.y) < rs && (f.x - s.x) ** 2 + (f.y - s.y) ** 2 < rs * rs) {
          food.splice(i, 1); s.mass += 1;
        }
      }
    }
  }
  while (food.length < FOOD_N) spawnFood();

  // Yutma
  if (phase === "play") {
    const arr = [...slimes.values()].filter((s) => s.deadT <= 0).sort((a, b) => b.mass - a.mass);
    for (let i = 0; i < arr.length; i++) {
      const a = arr[i];
      if (a.deadT > 0) continue;
      const ra = radius(a.mass);
      for (let j = i + 1; j < arr.length; j++) {
        const b = arr[j];
        if (b.deadT > 0 || b.shieldT > 0 || a.mass < b.mass * 1.25) continue;
        const rb = radius(b.mass);
        if (Math.hypot(a.x - b.x, a.y - b.y) < ra - rb * 0.3) {
          a.mass += b.mass * 0.8; a.eats++;
          b.deadT = 3; b.trail.length = 0;
          burst(b.x, b.y, b.color, 22);
          toast(`😋 <b>${esc(a.nickname)}</b> yuttu → <b>${esc(b.nickname)}</b>`);
          setFocus(a, 2.5, 2, `yuttu → ${b.nickname} 😋`);
        }
      }
    }
  }

  for (let i = fx.length - 1; i >= 0; i--) {
    const f = fx[i];
    f.t += dt;
    if (f.type === "p") { f.x += f.vx * dt; f.y += f.vy * dt; f.vx *= 0.94; f.vy *= 0.94; if (f.t > f.life) fx.splice(i, 1); }
    else if (f.t > 0.7) fx.splice(i, 1);
  }
}

function ranking() { return [...slimes.values()].sort((a, b) => b.mass - a.mass); }

function endRound() {
  phase = "end"; endT = END_SEC;
  winner = ranking()[0] || null;
  if (winner) {
    wins.set(winner.uid, (wins.get(winner.uid) || 0) + 1);
    setFocus(winner, END_SEC, 9, "KAZANDI! 👑");
    burst(winner.x, winner.y, "#ffd54a", 60);
    toast(`👑 <b>${esc(winner.nickname)}</b> ${round}. turu kazandı!`, "power");
  }
}
function newRound() {
  round++;
  winner = null;
  const t = now();
  for (const s of [...slimes.values()]) {
    if (t - s.lastActive > 600) { slimes.delete(s.uid); continue; }
    [s.x, s.y] = randPos(); s.mass = START_MASS; s.deadT = 0; s.shieldT = 0; s.frozenT = 0; s.dashT = 0; s.eats = 0;
  }
  food.length = 0;
  for (let i = 0; i < FOOD_N; i++) spawnFood();
  if (slimes.size) { phase = "play"; timeLeft = ROUND_SEC; } else phase = "idle";
}

// ---------- Çizim ----------
function drawBlob(s, t) {
  const rs = radius(s.mass);
  const sp = Math.hypot(s.vx, s.vy), va = Math.atan2(s.vy, s.vx);
  const stretch = Math.min(0.18, sp / 2500);
  const N = 30;
  // iz
  for (let i = 0; i < s.trail.length; i++) {
    const [x, y] = s.trail[i];
    g.globalAlpha = (i / s.trail.length) * 0.25;
    g.fillStyle = s.color;
    g.beginPath(); g.arc(x, y, rs * (0.5 + 0.5 * i / s.trail.length), 0, Math.PI * 2); g.fill();
  }
  g.globalAlpha = 1;
  g.beginPath();
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * Math.PI * 2;
    const wob = 0.045 * Math.sin(t * 3.2 + i * 1.1 + s.seed) + 0.03 * Math.sin(t * 5.1 - i * 0.7 + s.seed * 2);
    const dot = Math.cos(a - va);
    const rr = rs * (1 + wob + stretch * (dot * dot - 0.4)) * (s.frozenT > 0 ? 1 : 1);
    const x = s.x + Math.cos(a) * rr, y = s.y + Math.sin(a) * rr;
    i ? g.lineTo(x, y) : g.moveTo(x, y);
  }
  g.closePath();
  const gr = g.createRadialGradient(s.x - rs * 0.3, s.y - rs * 0.35, rs * 0.1, s.x, s.y, rs * 1.05);
  gr.addColorStop(0, "#ffffffcc"); gr.addColorStop(0.25, s.color); gr.addColorStop(1, shade(s.color, -0.45));
  g.fillStyle = gr; g.fill();
  g.lineWidth = Math.max(2, rs * 0.06); g.strokeStyle = shade(s.color, -0.55); g.stroke();

  // avatar ya da gözler
  if (s.img) {
    g.save(); g.beginPath(); g.arc(s.x, s.y, rs * 0.55, 0, Math.PI * 2); g.clip();
    g.drawImage(s.img, s.x - rs * 0.55, s.y - rs * 0.55, rs * 1.1, rs * 1.1);
    g.restore();
    g.lineWidth = Math.max(2, rs * 0.05); g.strokeStyle = "#fff"; g.beginPath(); g.arc(s.x, s.y, rs * 0.55, 0, Math.PI * 2); g.stroke();
  } else {
    const ex = Math.cos(va) * rs * 0.08 * Math.min(1, sp / 100), ey = Math.sin(va) * rs * 0.08 * Math.min(1, sp / 100);
    for (const side of [-1, 1]) {
      const cx = s.x + side * rs * 0.28, cy = s.y - rs * 0.12;
      g.fillStyle = "#fff"; g.beginPath(); g.ellipse(cx, cy, rs * 0.17, rs * 0.21, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#111"; g.beginPath(); g.arc(cx + ex, cy + ey, rs * 0.09, 0, Math.PI * 2); g.fill();
    }
    g.strokeStyle = "#111"; g.lineWidth = rs * 0.05; g.beginPath(); g.arc(s.x, s.y + rs * 0.18, rs * 0.18, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();
  }
  // parlama
  g.fillStyle = "rgba(255,255,255,.35)";
  g.beginPath(); g.ellipse(s.x - rs * 0.38, s.y - rs * 0.48, rs * 0.22, rs * 0.11, -0.6, 0, Math.PI * 2); g.fill();

  if (s.frozenT > 0) {
    g.fillStyle = "rgba(160,225,255,.45)"; g.beginPath(); g.arc(s.x, s.y, rs * 1.05, 0, Math.PI * 2); g.fill();
    g.font = `${rs * 0.6}px serif`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("❄️", s.x + rs * 0.6, s.y - rs * 0.6);
  }
  if (s.shieldT > 0) {
    g.save(); g.translate(s.x, s.y); g.rotate(t * 1.5);
    g.setLineDash([rs * 0.25, rs * 0.15]); g.lineWidth = Math.max(3, rs * 0.08);
    g.strokeStyle = `rgba(255,120,200,${0.6 + 0.3 * Math.sin(t * 8)})`;
    g.beginPath(); g.arc(0, 0, rs * 1.22, 0, Math.PI * 2); g.stroke();
    g.restore(); g.setLineDash([]);
  }
  // isim
  const fs = Math.max(13 / cam.z, Math.min(rs * 0.42, 60));
  g.font = `900 ${fs}px Segoe UI, sans-serif`; g.textAlign = "center"; g.textBaseline = "bottom";
  g.lineWidth = fs * 0.22; g.strokeStyle = "rgba(0,0,0,.8)"; g.fillStyle = "#fff";
  const label = (wins.get(s.uid) ? "👑" : "") + s.nickname;
  g.strokeText(label, s.x, s.y - rs * 1.08); g.fillText(label, s.x, s.y - rs * 1.08);
  g.font = `800 ${fs * 0.7}px Segoe UI, sans-serif`; g.textBaseline = "top"; g.fillStyle = "#ffd54a";
  g.strokeText(Math.round(s.mass), s.x, s.y + rs * 1.06); g.fillText(Math.round(s.mass), s.x, s.y + rs * 1.06);
}

function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  let r = n >> 16, gg = (n >> 8) & 255, b = n & 255;
  const f = (c) => Math.round(k < 0 ? c * (1 + k) : c + (255 - c) * k);
  return `rgb(${f(r)},${f(gg)},${f(b)})`;
}

function render(t) {
  const W = canvas.width, H = canvas.height;
  g.setTransform(1, 0, 0, 1, 0, 0);
  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#1a0f2e"); bg.addColorStop(1, "#08111f");
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  cam.apply(g, W, H);

  // arena
  g.fillStyle = "#121a30";
  g.beginPath(); g.arc(0, 0, R, 0, Math.PI * 2); g.fill();
  g.save(); g.beginPath(); g.arc(0, 0, R, 0, Math.PI * 2); g.clip();
  const vx0 = cam.x - W / 2 / cam.z, vx1 = cam.x + W / 2 / cam.z, vy0 = cam.y - H / 2 / cam.z, vy1 = cam.y + H / 2 / cam.z;
  g.strokeStyle = "rgba(120,160,255,.09)"; g.lineWidth = 2 / cam.z * 1.5;
  g.beginPath();
  for (let x = Math.floor(vx0 / 80) * 80; x < vx1; x += 80) { g.moveTo(x, vy0); g.lineTo(x, vy1); }
  for (let y = Math.floor(vy0 / 80) * 80; y < vy1; y += 80) { g.moveTo(vx0, y); g.lineTo(vx1, y); }
  g.stroke();
  g.restore();
  g.lineWidth = 14; g.strokeStyle = `rgba(51,225,255,${0.5 + 0.2 * Math.sin(t * 2)})`;
  g.shadowColor = "#33e1ff"; g.shadowBlur = 30;
  g.beginPath(); g.arc(0, 0, R, 0, Math.PI * 2); g.stroke();
  g.shadowBlur = 0;

  // yem
  for (const f of food) {
    if (f.x < vx0 - 20 || f.x > vx1 + 20 || f.y < vy0 - 20 || f.y > vy1 + 20) continue;
    g.fillStyle = f.c;
    g.beginPath(); g.arc(f.x, f.y, 6 + Math.sin(t * 4 + f.p) * 1.5, 0, Math.PI * 2); g.fill();
  }

  // efektler (dalga)
  for (const f of fx) {
    if (f.type !== "ring") continue;
    const k = f.t / 0.7;
    g.strokeStyle = f.c; g.globalAlpha = 1 - k; g.lineWidth = 18 * (1 - k) + 2;
    g.beginPath(); g.arc(f.x, f.y, f.r + (f.max - f.r) * k, 0, Math.PI * 2); g.stroke();
  }
  g.globalAlpha = 1;

  const arr = [...slimes.values()].filter((s) => s.deadT <= 0).sort((a, b) => a.mass - b.mass);
  for (const s of arr) drawBlob(s, t);

  for (const f of fx) {
    if (f.type !== "p") continue;
    g.globalAlpha = Math.max(0, 1 - f.t / f.life); g.fillStyle = f.c;
    g.beginPath(); g.arc(f.x, f.y, f.r, 0, Math.PI * 2); g.fill();
  }
  g.globalAlpha = 1;
}

function updateCamera(dt) {
  const W = canvas.width;
  const t = now();
  let target = focus && focus.until > t && focus.s.deadT <= 0 && slimes.has(focus.s.uid) ? focus.s : null;
  const focused = !!target;
  if (!target) target = ranking().find((s) => s.deadT <= 0);
  if (!target || phase === "idle") {
    cam.tx = 0; cam.ty = 0; cam.tz = W / (2 * R + 200);
  } else {
    const rs = radius(target.mass);
    const viewW = focused ? Math.max(650, rs * 8) : Math.max(1300, rs * 12);
    cam.tx = target.x; cam.ty = target.y; cam.tz = W / viewW;
  }
  cam.update(dt, focused ? 3.2 : 2);
}

// ---------- HUD ----------
let lastCenter = "";
function updateHud() {
  const t = now();
  const arr = ranking();
  $("count").textContent = `${slimes.size} 🫧`;
  $("rows").innerHTML = arr.slice(0, 8).map((s, i) => `<div class="row"><span class="pos">${["🥇", "🥈", "🥉"][i] || i + 1}</span><span class="sw" style="background:${s.color}"></span><span class="nm">${esc(s.nickname)}${wins.get(s.uid) ? ` <small style="color:#ffd54a">👑${wins.get(s.uid)}</small>` : ""}${s.deadT > 0 ? " 💀" : ""}</span><span class="val">${Math.round(s.mass)}</span></div>`).join("")
    || `<div class="row" style="opacity:.8">🌹 Gül at, ilk slime sen ol!</div>`;
  if (phase === "idle") { $("stBig").textContent = "BEKLENİYOR"; $("stSub").textContent = "🌹 Gül at, slime ol!"; }
  else if (phase === "play") {
    const m = Math.floor(Math.max(0, timeLeft) / 60), s = Math.floor(Math.max(0, timeLeft) % 60);
    $("stBig").textContent = `⏱️ ${m}:${String(s).padStart(2, "0")}`; $("stSub").textContent = `TUR ${round} • en büyük kazanır`;
  } else { $("stBig").textContent = "🏁 BİTTİ"; $("stSub").textContent = `Yeni tur ${Math.ceil(endT)} sn`; }

  let key = "";
  let html = "";
  if (phase === "end" && winner) { key = "w" + round; html = `<div class="msg">👑 ${esc(winner.nickname)}</div><div class="sub">EN BÜYÜK SLIME! (${wins.get(winner.uid)} galibiyet)</div>`; }
  else if (phase === "play" && timeLeft <= 10) { key = "c" + Math.ceil(timeLeft); html = `<div class="msg">${Math.ceil(timeLeft)}</div>`; }
  if (key !== lastCenter) { $("center").innerHTML = html; lastCenter = key; }

  const f = focus && focus.until > t ? focus : null;
  $("focus").innerHTML = f && phase !== "end" ? `<span>🎥 ${esc(f.s.nickname)} ${esc(f.label || "")}</span>` : "";
}

let last = performance.now(), hudT = 0;
function loop(ms) {
  const dt = Math.min(0.05, (ms - last) / 1000);
  last = ms;
  step(dt);
  updateCamera(dt);
  render(ms / 1000);
  if ((hudT -= dt) <= 0) { hudT = 0.2; updateHud(); }
  requestAnimationFrame(loop);
}
updateHud();
requestAnimationFrame(loop);
