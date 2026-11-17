// Canlı Futbol — TikTok LIVE etkileşimli maç.
// 🌹 Gül → takıma gir (yorum "1"/"kırmızı" ya da "2"/"mavi" ile takım seç).
// 🎵 TikTok = SPRINT, 🎮 GG = GÜÇLÜ ŞUT, 🍦 Dondurma = rakip kaleciyi dondur,
// 🫰 Parmak kalp = ALTIN ŞUT (kaleci tutamaz), 🍩 Donut = PENALTI. ❤️ Beğeni = hız.
import { $, esc, toast, nick, connectLive, setupDemo, loadAvatar, renderGiftLegend, Cam2D, setupCanvas, PARAMS } from "./live_common.js?v=1";

const HW = 340, HL = 520; // saha yarı genişlik / yarı uzunluk
const GW = 170; // kale genişliği
const PR = 20, BR = 9; // oyuncu / top yarıçapı
const MATCH_SEC = Number(PARAMS.get("sure")) || 180;
const MIN_FIELD = 3; // takım başına en az saha oyuncusu (eksikse bot)
const MAX_PER_TEAM = 11;
const TEAMS = {
  red: { name: "KIRMIZI", emoji: "🔴", color: "#ff3b4e", dark: "#9c1424", dir: -1, ownY: HL },
  blue: { name: "MAVİ", emoji: "🔵", color: "#2f8bff", dark: "#123f8a", dir: 1, ownY: -HL },
};
const other = (t) => (t === "red" ? "blue" : "red");

renderGiftLegend($("legend"), [
  ["rose", "takıma gir"],
  ["tiktok", "SPRINT"],
  ["gg", "GÜÇLÜ ŞUT"],
  ["icecream", "kaleciyi dondur"],
  ["heart", "ALTIN ŞUT"],
  ["donut", "PENALTI"],
]);

const canvas = $("scene");
const g = setupCanvas(canvas);
const cam = new Cam2D();
cam.tz = 1;

const players = new Map();
const pref = new Map();
const score = { red: 0, blue: 0 };
const keepers = {
  red: { team: "red", x: 0, y: HL - 18, frozenT: 0, diveX: null },
  blue: { team: "blue", x: 0, y: -HL + 18, frozenT: 0, diveX: null },
};
const ball = { x: 0, y: 0, vx: 0, vy: 0, owner: null, last: null, kind: "", saveChecked: false, spin: 0, trail: [] };
const fx = [];
let phase = "play"; // play | goal | penalty | fulltime
let phaseT = 0;
let timeLeft = MATCH_SEC;
let matchNo = 1;
let lastGoal = null;
let penalty = null;
let focus = null;
let botN = 0;
let crowdJump = 0;

const now = () => performance.now() / 1000;
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function teamList(team, { bots = true } = {}) {
  return [...players.values()].filter((p) => p.team === team && (bots || !p.bot));
}

function makePlayer(user, uid, team, bot = false) {
  const p = {
    uid, nickname: bot ? "🤖 Bot" : nick(user), team, bot,
    x: rand(-200, 200), y: TEAMS[team].ownY + TEAMS[team].dir * rand(150, 400), vx: 0, vy: 0,
    sprintT: 0, superShot: "", kickCd: 0, goals: 0, img: null, lastActive: now(), trail: [],
  };
  if (!bot) loadAvatar(user, (img) => { p.img = img; });
  players.set(uid, p);
  return p;
}

function balanceBots() {
  for (const team of ["red", "blue"]) {
    const list = teamList(team);
    const real = list.filter((p) => !p.bot).length;
    const bots = list.filter((p) => p.bot);
    const need = Math.max(0, MIN_FIELD - real);
    for (let i = bots.length; i < need; i++) makePlayer(null, `bot_${team}_${++botN}`, team, true);
    for (let i = need; i < bots.length; i++) { if (ball.owner === bots[i]) ball.owner = null; players.delete(bots[i].uid); }
  }
}
balanceBots();

function joinPlayer(user, uid) {
  if (players.has(uid)) return players.get(uid);
  let team = pref.get(uid);
  const r = teamList("red", { bots: false }).length, b = teamList("blue", { bots: false }).length;
  if (!team) team = r <= b ? "red" : "blue";
  if (teamList(team, { bots: false }).length >= MAX_PER_TEAM) team = other(team);
  if (teamList(team, { bots: false }).length >= MAX_PER_TEAM) {
    // en uzun süredir sessiz olanın yerine geç
    const idle = teamList(team, { bots: false }).sort((a, c) => a.lastActive - c.lastActive)[0];
    if (idle) { if (ball.owner === idle) ball.owner = null; players.delete(idle.uid); }
  }
  const p = makePlayer(user, uid, team);
  balanceBots();
  toast(`🌹 <b>${esc(p.nickname)}</b> ${TEAMS[team].emoji} ${TEAMS[team].name} takıma girdi!`, "join");
  setFocus(p, 3, 1, `${TEAMS[team].emoji} sahaya çıktı!`);
  return p;
}

function setFocus(p, sec, prio, label) {
  const t = now();
  if (focus && focus.until > t && focus.prio > prio && focus.p !== p) return;
  focus = { p, until: t + sec, prio, label };
}

function startPenalty(p) {
  if (phase !== "play") { p.superShot = "golden"; p.sprintT = Math.max(p.sprintT, 5); return; }
  const d = TEAMS[p.team].dir;
  const goalY = -TEAMS[p.team].ownY; // rakip kale çizgisi
  penalty = { p, t: 1.8, spotY: goalY - d * 110 };
  phase = "penalty";
  ball.owner = null; ball.vx = ball.vy = 0; ball.x = 0; ball.y = penalty.spotY; ball.trail.length = 0;
  p.x = 0; p.y = penalty.spotY - d * 34; p.vx = p.vy = 0;
  const k = keepers[other(p.team)];
  k.x = 0; k.diveX = null;
  setFocus(p, 4, 5, "PENALTI! 🍩");
  fx.push({ type: "txt", x: 0, y: penalty.spotY - TEAMS[p.team].dir * 60, t: -0.4, txt: "PENALTI! 🍩", c: "#ffd54a" });
}

// ---------- Canlı olaylar ----------
const chatCd = new Map();
function onEvent(e) {
  if (e.kind === "chat") {
    const t = e.text.trim().toLowerCase();
    if (/^(1|kırmızı|kirmizi|red|🔴)$/.test(t)) pref.set(e.uid, "red");
    else if (/^(2|mavi|blue|🔵)$/.test(t)) pref.set(e.uid, "blue");
  }
  let p = players.get(e.uid);
  if (e.kind === "gift") {
    if (!p) {
      p = joinPlayer(e.user, e.uid);
      if (e.gift === "rose") return;
    }
    p.lastActive = now();
    const name = esc(p.nickname);
    switch (e.gift) {
      case "rose":
        p.sprintT = Math.max(p.sprintT, 2 * e.repeat);
        break;
      case "tiktok":
        p.sprintT = Math.max(p.sprintT, 5 + e.repeat);
        setFocus(p, 3, 2, "SPRINT! 💨");
        toast(`🎵 <b>${name}</b> → SPRINT! 💨`, "power");
        break;
      case "gg":
        p.superShot = p.superShot === "golden" ? "golden" : "power";
        p.sprintT = Math.max(p.sprintT, 6);
        setFocus(p, 4, 2, "GÜÇLÜ ŞUT geliyor! 💥");
        toast(`🎮 <b>${name}</b> → GÜÇLÜ ŞUT hazırlıyor! 💥`, "power");
        break;
      case "icecream": {
        const k = keepers[other(p.team)];
        k.frozenT = Math.max(k.frozenT, 6 + e.repeat * 2);
        setFocus(p, 3, 2, "rakip kaleciyi dondurdu! 🍦");
        toast(`🍦 <b>${name}</b> → ${TEAMS[other(p.team)].emoji} kaleci DONDU! ❄️`, "ice");
        break;
      }
      case "heart":
        p.superShot = "golden";
        p.sprintT = Math.max(p.sprintT, 6);
        setFocus(p, 4, 3, "ALTIN ŞUT! ✨");
        toast(`🫰 <b>${name}</b> → ALTIN ŞUT! ✨ (kaleci tutamaz)`, "power");
        break;
      case "donut":
      case "big":
        startPenalty(p);
        cam.shake = 0.6;
        toast(`${e.gift === "donut" ? "🍩" : "🎁"} <b>${name}</b> ${esc(e.name)} → PENALTI! ⚽`, "power");
        break;
      default:
        p.sprintT = Math.max(p.sprintT, 3);
        setFocus(p, 2.5, 2, "hızlandı! ⚡");
        toast(`🎁 <b>${name}</b> ${esc(e.name)} → hız! ⚡`, "power");
    }
    return;
  }
  if (!p) {
    if (e.kind === "chat" && /kat[ıi]l|oyna|futbol|tak[ıi]m|join|^[12]$/i.test(e.text)) toast(`🌹 <b>${esc(nick(e.user))}</b>, takıma girmek için <b>Gül</b> at!`);
    return;
  }
  p.lastActive = now();
  if (e.kind === "like") {
    p.sprintT = Math.min(6, p.sprintT + Math.min(2, e.count * 0.12));
    if (e.count >= 10) setFocus(p, 2, 1, "hızlanıyor! ❤️");
  } else if (e.kind === "chat") {
    const t = now();
    if (t - (chatCd.get(p.uid) || 0) < 1.5) return;
    chatCd.set(p.uid, t);
    p.sprintT = Math.max(p.sprintT, 0.8);
  } else if (e.kind === "follow" || e.kind === "share") {
    p.sprintT = Math.max(p.sprintT, 4);
    setFocus(p, 2.5, 1, e.kind === "follow" ? "takip etti! ➕" : "paylaştı! 🔄");
  }
}

connectLive(onEvent);
window.futbol = { onEvent, players, score };
setupDemo(onEvent, () => [...players.values()].filter((p) => !p.bot), { newRate: 0.08, maxNew: 14 });

// ---------- Fizik / yapay zekâ ----------
function kick(p, tx, ty, speed, kind = "") {
  const dx = tx - ball.x, dy = ty - ball.y, d = Math.hypot(dx, dy) || 1;
  ball.vx = (dx / d) * speed; ball.vy = (dy / d) * speed;
  ball.owner = null; ball.last = p; ball.kind = kind; ball.saveChecked = false;
  p.kickCd = 0.45;
}

function shoot(p, kind) {
  const goalY = -TEAMS[p.team].ownY;
  const side = Math.random() < 0.5 ? -1 : 1;
  const tx = side * rand(GW * 0.22, GW * 0.42);
  const speed = kind === "golden" ? 1150 : kind === "power" ? 1050 : rand(560, 760);
  kick(p, tx, goalY + TEAMS[p.team].dir * 30, speed, kind || "shot");
  if (kind) {
    cam.shake = 0.5;
    setFocus(p, 2.2, 4, kind === "golden" ? "ALTIN ŞUT! ✨" : "GÜÇLÜ ŞUT! 💥");
  }
}

function homePos(p, idx, n) {
  const T = TEAMS[p.team];
  const row = Math.floor(idx / 3), col = idx % 3, inRow = Math.min(3, n - row * 3);
  const spread = inRow === 1 ? 0 : inRow === 2 ? (col === 0 ? -1 : 1) * 110 : (col - 1) * 200;
  let y = T.ownY + T.dir * (190 + row * 150);
  let x = spread + (row % 2) * 50;
  y += ball.y * 0.45; x += ball.x * 0.25;
  return [clamp(x, -HW + 30, HW - 30), clamp(y, -HL + 40, HL - 40)];
}

function stepPlayers(dt) {
  const frozen = phase !== "play";
  // her takımda topa en yakın oyuncu topa koşar
  const chaser = {};
  for (const team of ["red", "blue"]) {
    let best = null, bd = 1e9;
    for (const p of teamList(team)) {
      const d = Math.hypot(p.x - ball.x, p.y - ball.y) - (p.superShot ? 400 : 0) - (p.sprintT > 0 ? 80 : 0);
      if (d < bd) { bd = d; best = p; }
    }
    chaser[team] = best;
  }
  for (const team of ["red", "blue"]) {
    const list = teamList(team);
    list.forEach((p, idx) => {
      p.kickCd = Math.max(0, p.kickCd - dt);
      p.sprintT = Math.max(0, p.sprintT - dt);
      let tx, ty;
      const T = TEAMS[team];
      if (ball.owner === p) {
        tx = clamp(p.x * 0.6 + Math.sin(now() * 1.3 + idx) * 60, -GW, GW); ty = -T.ownY;
      } else if (chaser[team] === p || p.superShot) {
        tx = ball.x; ty = ball.y + (ball.owner ? 0 : T.dir * -6);
      } else {
        [tx, ty] = homePos(p, idx, list.length);
      }
      let sp = 175 + (p.bot ? -15 : 0);
      if (p.sprintT > 0) sp *= 1.75;
      if (ball.owner === p) sp *= 0.85;
      if (frozen) sp = 0;
      const dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy);
      const want = d < 6 ? 0 : sp;
      const k = Math.min(1, dt * 6);
      p.vx += ((d ? dx / d : 0) * want - p.vx) * k;
      p.vy += ((d ? dy / d : 0) * want - p.vy) * k;
      p.x = clamp(p.x + p.vx * dt, -HW + PR, HW - PR);
      p.y = clamp(p.y + p.vy * dt, -HL + PR, HL - PR);
      if (p.sprintT > 0 || p.superShot) p.trail.push([p.x, p.y]);
      if (p.trail.length > 10 || (!(p.sprintT > 0) && !p.superShot && p.trail.length)) p.trail.shift();
    });
  }
  // oyuncular birbirinin içinden geçmesin
  const arr = [...players.values()];
  for (let i = 0; i < arr.length; i++) for (let j = i + 1; j < arr.length; j++) {
    const a = arr[i], b = arr[j];
    const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
    if (d > 0 && d < PR * 2) { const push = (PR * 2 - d) / 2; a.x -= (dx / d) * push; a.y -= (dy / d) * push; b.x += (dx / d) * push; b.y += (dy / d) * push; }
  }
}

function stepBall(dt) {
  if (phase === "penalty" || phase === "fulltime") {
    if (phase === "penalty" && penalty && penalty.kicked) integrateBall(dt);
    return;
  }
  if (ball.owner) {
    const p = ball.owner;
    if (!players.has(p.uid)) { ball.owner = null; return; }
    const T = TEAMS[p.team];
    const fx_ = p.vx || 0, fy = p.vy || T.dir;
    const fd = Math.hypot(fx_, fy) || 1;
    ball.x = p.x + (fx_ / fd) * (PR + BR + 2); ball.y = p.y + (fy / fd) * (PR + BR + 2);
    ball.vx = p.vx; ball.vy = p.vy;
    ball.spin += dt * Math.hypot(p.vx, p.vy) / 10;
    if (phase !== "play") return;
    const goalY = -T.ownY;
    const distGoal = Math.hypot(ball.x, ball.y - goalY);
    if (p.superShot) { const k = p.superShot; p.superShot = ""; shoot(p, k); return; }
    if (distGoal < 320 && Math.random() < dt * 2.5) { shoot(p, ""); return; }
    // pas
    if (Math.random() < dt * 0.6) {
      const mates = teamList(p.team).filter((m) => m !== p && (m.y - p.y) * T.dir > -40);
      if (mates.length) { const m = mates[(Math.random() * mates.length) | 0]; kick(p, m.x + m.vx * 0.3, m.y + m.vy * 0.3, 480, "pass"); return; }
    }
    // top kapma
    for (const o of teamList(other(p.team))) {
      if (Math.hypot(o.x - p.x, o.y - p.y) < PR * 2 + 8 && Math.random() < dt * (o.sprintT > 0 ? 3.5 : 1.6)) {
        ball.owner = o; ball.last = o; p.kickCd = 0.6;
        return;
      }
    }
    return;
  }
  integrateBall(dt);
  if (phase !== "play") return;
  // topa sahip ol
  for (const p of players.values()) {
    if (p.kickCd > 0) continue;
    if (Math.hypot(p.x - ball.x, p.y - ball.y) < PR + BR + 3 && Math.hypot(ball.vx, ball.vy) < (ball.last && ball.last.team === p.team ? 900 : 650)) {
      ball.owner = p; ball.last = p; ball.kind = "";
      break;
    }
  }
}

function integrateBall(dt) {
  ball.x += ball.vx * dt; ball.y += ball.vy * dt;
  const f = Math.exp(-dt * 0.85);
  ball.vx *= f; ball.vy *= f;
  ball.spin += dt * Math.hypot(ball.vx, ball.vy) / 10;
  if (ball.kind === "golden" || ball.kind === "power") ball.trail.push([ball.x, ball.y]);
  if (ball.trail.length > 14 || (ball.kind !== "golden" && ball.kind !== "power" && ball.trail.length)) ball.trail.shift();
  if (Math.abs(ball.x) > HW - BR) { ball.x = Math.sign(ball.x) * (HW - BR); ball.vx *= -0.7; }

  // kaleci kurtarışı
  for (const k of Object.values(keepers)) {
    const towards = (k.team === "red" ? ball.vy > 0 : ball.vy < 0);
    if (!towards || ball.saveChecked) continue;
    if (Math.hypot(ball.x - k.x, ball.y - k.y) < PR + BR + 14) {
      ball.saveChecked = true;
      const chance = k.frozenT > 0 || ball.kind === "golden" ? 0 : ball.kind === "power" ? 0.3 : ball.kind === "pen" ? 0.2 : 0.7;
      if (Math.random() < chance) {
        ball.vy = -ball.vy * 0.55; ball.vx = rand(-300, 300);
        ball.kind = ""; ball.trail.length = 0;
        toast(`🧤 ${TEAMS[k.team].emoji} kaleci kurtardı!`);
        fx.push({ type: "txt", x: k.x, y: k.y, t: 0, txt: "KURTARIŞ! 🧤", c: "#fff" });
        if (phase === "penalty") penalty.done = 1.4;
      }
    }
  }

  if (Math.abs(ball.y) > HL - BR) {
    if (Math.abs(ball.x) < GW / 2 - BR && phase !== "goal") {
      const scorerTeam = ball.y < 0 ? "red" : "blue";
      goal(scorerTeam);
    } else if (Math.abs(ball.y) > HL - BR) {
      ball.y = Math.sign(ball.y) * (HL - BR); ball.vy *= -0.6; ball.kind = "";
      if (phase === "penalty") penalty.done = Math.min(penalty.done || 1.2, 1.2);
    }
  }
}

function goal(team) {
  score[team]++;
  const p = ball.last && ball.last.team === team ? ball.last : null;
  if (p) p.goals++;
  lastGoal = { team, p };
  phase = "goal"; phaseT = 3.2; penalty = null;
  ball.vx *= 0.2; ball.vy *= 0.2; ball.kind = ""; ball.trail.length = 0;
  crowdJump = 3;
  cam.shake = 1;
  for (let i = 0; i < 70; i++) {
    const a = Math.random() * Math.PI * 2, sp = rand(150, 700);
    fx.push({ type: "p", x: ball.x, y: ball.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: 0, life: rand(0.8, 1.6), c: Math.random() < 0.5 ? TEAMS[team].color : "#ffd54a" });
  }
  if (p) setFocus(p, 3.2, 8, "GOL ATTI! ⚽");
  toast(`⚽ GOL! ${TEAMS[team].emoji} ${p ? `<b>${esc(p.nickname)}</b>` : TEAMS[team].name} — ${score.red} : ${score.blue}`, "power");
}

function kickoff() {
  ball.x = 0; ball.y = 0; ball.vx = ball.vy = 0; ball.owner = null; ball.kind = ""; ball.trail.length = 0;
  for (const team of ["red", "blue"]) {
    const list = teamList(team);
    list.forEach((p, i) => { [p.x, p.y] = homePos(p, i, list.length); p.vx = p.vy = 0; });
  }
  phase = "play";
}

function stepKeepers(dt) {
  for (const k of Object.values(keepers)) {
    k.frozenT = Math.max(0, k.frozenT - dt);
    if (k.frozenT > 0) continue;
    let tx;
    if (phase === "penalty" && penalty && penalty.kicked && k.diveX !== null) tx = k.diveX;
    else {
      const near = Math.abs(ball.y - k.y) < 300;
      tx = clamp(ball.x * (near ? 0.9 : 0.5), -GW / 2 + 6, GW / 2 - 6);
    }
    const sp = phase === "penalty" ? 330 : 260;
    k.x += clamp(tx - k.x, -sp * dt, sp * dt);
  }
}

function stepPenalty(dt) {
  const pen = penalty;
  if (!pen) { phase = "play"; return; }
  if (!players.has(pen.p.uid)) { penalty = null; phase = "play"; return; }
  if (!pen.kicked) {
    pen.t -= dt;
    if (pen.t <= 0) {
      pen.kicked = true;
      const side = Math.random() < 0.5 ? -1 : 1;
      const goalY = -TEAMS[pen.p.team].ownY;
      kick(pen.p, side * rand(GW * 0.25, GW * 0.42), goalY + TEAMS[pen.p.team].dir * 30, 1000, "pen");
      const k = keepers[other(pen.p.team)];
      k.diveX = (Math.random() < 0.45 ? side : -side) * GW * 0.38; // %45 doğru tarafa atlar
      cam.shake = 0.5;
    }
  } else if (pen.done !== undefined) {
    pen.done -= dt;
    if (pen.done <= 0) { penalty = null; kickoff(); }
  } else if (Math.hypot(ball.vx, ball.vy) < 30) pen.done = 0.8;
}

function step(dt) {
  if (phase === "play" || phase === "penalty") {
    timeLeft -= dt;
    if (timeLeft <= 0 && phase === "play") {
      phase = "fulltime"; phaseT = 8; crowdJump = 3;
      const win = score.red === score.blue ? null : score.red > score.blue ? "red" : "blue";
      const mvp = [...players.values()].filter((p) => !p.bot).sort((a, b) => b.goals - a.goals)[0];
      lastGoal = { fulltime: true, win, mvp: mvp && mvp.goals ? mvp : null };
      if (mvp && mvp.goals) setFocus(mvp, 8, 9, "MAÇIN YILDIZI! ⭐");
    }
  }
  if (phase === "goal") { phaseT -= dt; if (phaseT <= 0) kickoff(); }
  if (phase === "fulltime") {
    phaseT -= dt;
    if (phaseT <= 0) {
      matchNo++; score.red = score.blue = 0; timeLeft = MATCH_SEC;
      const t = now();
      for (const p of [...players.values()]) { if (!p.bot && t - p.lastActive > 600) players.delete(p.uid); else p.goals = 0; }
      balanceBots();
      kickoff();
    }
  }
  if (phase === "penalty") stepPenalty(dt);
  stepPlayers(dt);
  stepKeepers(dt);
  stepBall(dt);
  crowdJump = Math.max(0, crowdJump - dt);
  for (let i = fx.length - 1; i >= 0; i--) {
    const f = fx[i];
    f.t += dt;
    if (f.type === "p") { f.x += f.vx * dt; f.y += f.vy * dt; f.vx *= 0.95; f.vy *= 0.95; if (f.t > f.life) fx.splice(i, 1); }
    else if (f.t > 1.4) fx.splice(i, 1);
  }
}

// ---------- Çizim ----------
const crowd = [];
for (let i = 0; i < 900; i++) {
  const side = (Math.random() * 4) | 0;
  let x, y;
  if (side < 2) { x = (side ? 1 : -1) * rand(HW + 70, HW + 260); y = rand(-HL - 200, HL + 200); }
  else { x = rand(-HW - 260, HW + 260); y = (side === 2 ? 1 : -1) * rand(HL + 90, HL + 260); }
  crowd.push({ x, y, c: Math.random() < 0.5 ? (x > 0 ? "#ff3b4e" : "#2f8bff") : ["#fff", "#ffd54a", "#bbb", "#444"][(Math.random() * 4) | 0], p: Math.random() * 6 });
}

function render(t) {
  const W = canvas.width, H = canvas.height;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.fillStyle = "#151a22"; g.fillRect(0, 0, W, H);
  cam.apply(g, W, H);

  // tribün
  g.fillStyle = "#1f2633"; g.fillRect(-HW - 280, -HL - 280, (HW + 280) * 2, (HL + 280) * 2);
  for (const c of crowd) {
    const j = crowdJump > 0 ? Math.abs(Math.sin(t * 12 + c.p)) * 6 : Math.sin(t * 2 + c.p) * 1;
    g.fillStyle = c.c; g.beginPath(); g.arc(c.x, c.y - j, 6, 0, Math.PI * 2); g.fill();
  }
  // çim
  g.fillStyle = "#2f7d32"; g.fillRect(-HW - 50, -HL - 60, (HW + 50) * 2, (HL + 60) * 2);
  for (let i = 0, y = -HL; y < HL; y += 80, i++) { g.fillStyle = i % 2 ? "#378c39" : "#2f8133"; g.fillRect(-HW, y, HW * 2, Math.min(80, HL - y)); }
  // çizgiler
  g.strokeStyle = "rgba(255,255,255,.9)"; g.lineWidth = 4;
  g.strokeRect(-HW, -HL, HW * 2, HL * 2);
  g.beginPath(); g.moveTo(-HW, 0); g.lineTo(HW, 0); g.stroke();
  g.beginPath(); g.arc(0, 0, 90, 0, Math.PI * 2); g.stroke();
  g.fillStyle = "#fff"; g.beginPath(); g.arc(0, 0, 5, 0, Math.PI * 2); g.fill();
  for (const s of [-1, 1]) {
    g.strokeRect(-200, s > 0 ? HL - 165 : -HL, 400, 165);
    g.strokeRect(-100, s > 0 ? HL - 55 : -HL, 200, 55);
    g.beginPath(); g.arc(0, s * (HL - 110), 4, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(0, s * (HL - 110), 90, s > 0 ? Math.PI * 1.2 : Math.PI * 0.2, s > 0 ? Math.PI * 1.8 : Math.PI * 0.8); g.stroke();
    // kale + file
    const gy = s * HL, depth = 40;
    g.fillStyle = "rgba(255,255,255,.12)"; g.fillRect(-GW / 2, s > 0 ? gy : gy - depth, GW, depth);
    g.strokeStyle = "rgba(255,255,255,.35)"; g.lineWidth = 1.5; g.beginPath();
    for (let x = -GW / 2; x <= GW / 2; x += 12) { g.moveTo(x, gy); g.lineTo(x, gy + s * depth); }
    for (let d = 0; d <= depth; d += 10) { g.moveTo(-GW / 2, gy + s * d); g.lineTo(GW / 2, gy + s * d); }
    g.stroke();
    g.strokeStyle = "#fff"; g.lineWidth = 6; g.beginPath();
    g.moveTo(-GW / 2, gy); g.lineTo(-GW / 2, gy + s * depth); g.lineTo(GW / 2, gy + s * depth); g.lineTo(GW / 2, gy); g.stroke();
    g.lineWidth = 4;
  }
  // takım isimleri çimde
  g.font = "900 46px Segoe UI, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
  g.fillStyle = "rgba(255,255,255,.10)";
  g.fillText(`${TEAMS.blue.name}`, 0, -HL / 2); g.fillText(`${TEAMS.red.name}`, 0, HL / 2);

  // kaleciler
  for (const k of Object.values(keepers)) drawKeeper(k, t);
  // oyuncular
  const list = [...players.values()].sort((a, b) => a.y - b.y);
  for (const p of list) drawPlayer(p, t);
  drawBall(t);

  for (const f of fx) {
    if (f.type === "p") {
      g.globalAlpha = Math.max(0, 1 - f.t / f.life); g.fillStyle = f.c;
      g.fillRect(f.x - 5, f.y - 3, 10, 6);
    } else if (f.type === "txt") {
      g.globalAlpha = Math.max(0, 1 - f.t / 1.4);
      g.font = "900 28px Segoe UI, sans-serif"; g.textAlign = "center"; g.lineWidth = 6; g.strokeStyle = "#000"; g.fillStyle = f.c;
      g.strokeText(f.txt, f.x, f.y - 40 - f.t * 30); g.fillText(f.txt, f.x, f.y - 40 - f.t * 30);
    }
  }
  g.globalAlpha = 1;
}

function drawKeeper(k, t) {
  g.fillStyle = "rgba(0,0,0,.25)"; g.beginPath(); g.ellipse(k.x + 4, k.y + 6, PR, PR * 0.7, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = k.team === "red" ? "#ffb300" : "#00c853";
  g.beginPath(); g.arc(k.x, k.y, PR + 2, 0, Math.PI * 2); g.fill();
  g.lineWidth = 4; g.strokeStyle = TEAMS[k.team].color; g.stroke();
  g.font = "22px serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("🧤", k.x, k.y + 1);
  if (k.frozenT > 0) {
    g.fillStyle = "rgba(160,225,255,.55)"; g.beginPath(); g.arc(k.x, k.y, PR + 10, 0, Math.PI * 2); g.fill();
    g.font = "26px serif"; g.fillText("❄️", k.x + 22, k.y - 22);
  }
}

function drawPlayer(p, t) {
  const T = TEAMS[p.team];
  for (let i = 0; i < p.trail.length; i++) {
    g.globalAlpha = (i / p.trail.length) * 0.3; g.fillStyle = p.superShot === "golden" ? "#ffd54a" : T.color;
    g.beginPath(); g.arc(p.trail[i][0], p.trail[i][1], PR * (0.4 + 0.6 * i / p.trail.length), 0, Math.PI * 2); g.fill();
  }
  g.globalAlpha = 1;
  g.fillStyle = "rgba(0,0,0,.25)"; g.beginPath(); g.ellipse(p.x + 4, p.y + 6, PR, PR * 0.7, 0, 0, Math.PI * 2); g.fill();
  if (p.superShot) {
    g.fillStyle = p.superShot === "golden" ? `rgba(255,213,74,${0.35 + 0.2 * Math.sin(t * 10)})` : `rgba(255,120,40,${0.35 + 0.2 * Math.sin(t * 10)})`;
    g.beginPath(); g.arc(p.x, p.y, PR + 12, 0, Math.PI * 2); g.fill();
  }
  g.fillStyle = p.bot ? T.dark : T.color;
  g.beginPath(); g.arc(p.x, p.y, PR, 0, Math.PI * 2); g.fill();
  if (p.img) {
    g.save(); g.beginPath(); g.arc(p.x, p.y, PR - 4, 0, Math.PI * 2); g.clip();
    g.drawImage(p.img, p.x - PR + 4, p.y - PR + 4, (PR - 4) * 2, (PR - 4) * 2); g.restore();
  } else {
    g.fillStyle = "#fff"; g.font = "900 18px Segoe UI, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText(p.bot ? "🤖" : (p.nickname[0] || "?").toUpperCase(), p.x, p.y + 1);
  }
  g.lineWidth = 3; g.strokeStyle = "#fff"; g.beginPath(); g.arc(p.x, p.y, PR, 0, Math.PI * 2); g.stroke();
  if (!p.bot) {
    const fs = Math.max(13, 15 / Math.max(0.6, cam.z / 1.4));
    g.font = `800 ${fs}px Segoe UI, sans-serif`; g.textAlign = "center"; g.textBaseline = "bottom";
    g.lineWidth = 4; g.strokeStyle = "rgba(0,0,0,.85)"; g.fillStyle = "#fff";
    const label = (p.goals ? "⚽".repeat(Math.min(3, p.goals)) + " " : "") + p.nickname;
    g.strokeText(label, p.x, p.y - PR - 4); g.fillText(label, p.x, p.y - PR - 4);
  }
}

function drawBall(t) {
  for (let i = 0; i < ball.trail.length; i++) {
    g.globalAlpha = (i / ball.trail.length) * 0.5; g.fillStyle = ball.kind === "golden" ? "#ffd54a" : "#ff7a2a";
    g.beginPath(); g.arc(ball.trail[i][0], ball.trail[i][1], BR * (0.4 + 0.8 * i / ball.trail.length), 0, Math.PI * 2); g.fill();
  }
  g.globalAlpha = 1;
  g.fillStyle = "rgba(0,0,0,.3)"; g.beginPath(); g.ellipse(ball.x + 3, ball.y + 4, BR, BR * 0.7, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = ball.kind === "golden" ? "#ffd54a" : "#fff";
  g.beginPath(); g.arc(ball.x, ball.y, BR, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#222";
  for (let i = 0; i < 3; i++) {
    const a = ball.spin + (i * Math.PI * 2) / 3;
    g.beginPath(); g.arc(ball.x + Math.cos(a) * BR * 0.5, ball.y + Math.sin(a) * BR * 0.5, BR * 0.28, 0, Math.PI * 2); g.fill();
  }
  g.lineWidth = 1.5; g.strokeStyle = "#333"; g.beginPath(); g.arc(ball.x, ball.y, BR, 0, Math.PI * 2); g.stroke();
}

function updateCamera(dt) {
  const W = canvas.width, H = canvas.height;
  const t = now();
  const fitZ = Math.min(W / (HW * 2 + 90), H / (HL * 2 + 520));
  const f = focus && focus.until > t && players.has(focus.p.uid) ? focus.p : null;
  if (phase === "penalty" && penalty) {
    const gy = -TEAMS[penalty.p.team].ownY;
    cam.tx = 0; cam.ty = (penalty.spotY + gy) / 2; cam.tz = W / 520;
  } else if (f) {
    cam.tx = f.x; cam.ty = f.y; cam.tz = W / 500;
  } else {
    // topu takip eden geniş açı
    cam.tx = clamp(ball.x * 0.35, -60, 60);
    cam.ty = clamp(ball.y * 0.55, -HL * 0.4, HL * 0.4);
    cam.tz = Math.max(fitZ, W / (HW * 2 + 140));
  }
  // HUD'un altında kalmasın diye hedefi ekranın biraz altına kaydır
  cam.ty -= (H * 0.04) / cam.z;
  cam.update(dt, f ? 3 : 2.2);
}

// ---------- HUD ----------
let lastCenter = "";
function updateHud() {
  const t = now();
  const real = [...players.values()].filter((p) => !p.bot);
  $("count").textContent = `${real.length} 👟`;
  const top = real.sort((a, b) => b.goals - a.goals || b.lastActive - a.lastActive).slice(0, 7);
  $("rows").innerHTML = top.map((p, i) => `<div class="row"><span class="pos">${p.goals ? ["🥇", "🥈", "🥉"][i] || i + 1 : TEAMS[p.team].emoji}</span><span class="sw" style="background:${TEAMS[p.team].color}"></span><span class="nm">${esc(p.nickname)}</span><span class="val">${p.goals ? `⚽ ${p.goals}` : ""}</span></div>`).join("")
    || `<div class="row" style="opacity:.85">🌹 Gül at, sahaya çık!<br/>Takım: yorum 1 🔴 / 2 🔵</div>`;
  const m = Math.floor(Math.max(0, timeLeft) / 60), s = Math.floor(Math.max(0, timeLeft) % 60);
  $("stBig").innerHTML = `🔴 ${score.red} - ${score.blue} 🔵`;
  $("stSub").textContent = phase === "fulltime" ? `Yeni maç ${Math.ceil(phaseT)} sn` : `⏱️ ${m}:${String(s).padStart(2, "0")} • Maç ${matchNo}`;

  let key = "", html = "";
  if (phase === "goal" && lastGoal) {
    key = `g${score.red}-${score.blue}`;
    html = `<div class="msg" style="color:${TEAMS[lastGoal.team].color}">GOOOL! ⚽</div><div class="sub">${lastGoal.p ? esc(lastGoal.p.nickname) : TEAMS[lastGoal.team].name} • ${score.red} - ${score.blue}</div>`;
  } else if (phase === "fulltime" && lastGoal && lastGoal.fulltime) {
    key = "ft" + matchNo;
    html = `<div class="msg">${lastGoal.win ? `${TEAMS[lastGoal.win].emoji} ${TEAMS[lastGoal.win].name} KAZANDI!` : "BERABERE! 🤝"}</div><div class="sub">${score.red} - ${score.blue}${lastGoal.mvp ? ` • ⭐ ${esc(lastGoal.mvp.nickname)} (${lastGoal.mvp.goals} gol)` : ""}</div>`;
  }
  if (key !== lastCenter) { $("center").innerHTML = html; lastCenter = key; }
  const f = focus && focus.until > t ? focus : null;
  $("focus").innerHTML = f && phase !== "fulltime" ? `<span>🎥 ${TEAMS[f.p.team].emoji} ${esc(f.p.nickname)} ${esc(f.label || "")}</span>` : "";
}

let last = performance.now(), hudT = 0;
kickoff();
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
