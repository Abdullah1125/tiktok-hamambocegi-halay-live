import { generateAvatarDataUrl } from "./roach_factory.js?v=69";

const GIFT_ICONS = {
  1: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/eba3a9bb85c33e017f3648eaf88d7189~tplv-obj.webp",
  2: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/4e7ad6bdf0a1d860c538f38026d4e812~tplv-obj.webp",
  3: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/cf3db11b94a975417043b53401d0afe1~tplv-obj.webp",
};

const MODE_LABELS = {
  kirdgunu_ring: { title: "KIR DÜĞÜNÜ", sub: "ÇEMBER HALAY & TAKI" },
  halay_snake: { title: "MEYDAN HALAYI", sub: "S-KIVRIMLI YILAN HALAY" },
  horon: { title: "DÜĞÜN HORONU", sub: "7/16 KEMENÇE & ALTIN TAKI" },
  zeybek: { title: "ZEYBEK MEYDANI", sub: "HARMANDALI & EFE DİZ VURMA" },
  kapisma: { title: "MAHALLE KAPIŞMASI", sub: "GELİN 🔴 VS 🔵 DAMAT" },
};

const TICKER_RULES = [
  { icon: "💬", text: "Yoruma 'katıl' veya şehrini yaz", tag: "HALAYA GİR" },
  { icon: "🏙️", text: "Hediye at -> Şehrin x15 Puan", tag: "MEMLEKET" },
  { icon: "🥁", text: "Hediye ile Davulcu / Zurnacı ol", tag: "VIP ORKESTRA" },
  { icon: "🦅", text: "'halay', 'horon', 'zeybek' yaz", tag: "MOD SEÇ" },
  { icon: "🏆", text: "'!sıram' yaz", tag: "PUAN GÖR" },
];

function esc(s) {
  return String(s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

export class CommercialHudController {
  constructor(stageEl) {
    this.stageEl = stageEl;
    this.tier2Min = 20;
    this.tier3Min = 50;
    this.sceneMode = "kirdgunu_ring";
    this.lastGiftTs = Date.now();
    this.hitTimers = {};
    this.tickerIdx = 0;

    this._initLadder();
    this._startTicker();
    this._observeStageScale();
  }

  _observeStageScale() {
    const updateVars = () => {
      const w = this.stageEl.clientWidth || 400;
      const h = this.stageEl.clientHeight || 711;
      const u = Math.min(w, h * (9 / 16)) / 100;
      this.stageEl.style.setProperty("--u", `${u.toFixed(2)}px`);
      this.stageEl.style.setProperty("--h", `${(h / 100).toFixed(2)}px`);
    };
    new ResizeObserver(updateVars).observe(this.stageEl);
    updateVars();
  }

  _initLadder() {
    this.renderLadder();
    setInterval(() => {
      const ladder = document.getElementById("gift-ladder");
      const rib = document.getElementById("ladder-rib");
      if (!ladder || !rib) return;
      const idle = Date.now() - this.lastGiftTs > 28000;
      ladder.classList.toggle("idle", idle);
      rib.textContent = idle && (Math.floor(Date.now() / 4000) % 2 === 1)
        ? "1 JETON BİLE YETER 🌹"
        : "HEDİYE GÖNDER, DÜĞÜNÜ YÖNET";
    }, 4000);
  }

  renderLadder() {
    const ladder = document.getElementById("gift-ladder");
    if (!ladder) return;
    const ladderKey = `${this.tier2Min}:${this.tier3Min}`;
    if (this._lastLadderKey === ladderKey && ladder.children.length > 0) return;
    this._lastLadderKey = ladderKey;
    const rungs = [
      { tier: 1, coins: "1+ Jeton", label: "SPOT & ZIPLA", emoji: "🌹", best: false },
      { tier: 2, coins: `${this.tier2Min}+ Jeton`, label: "ALTIN TAK & COŞKU", emoji: "🍩", best: false },
      { tier: 3, coins: `${this.tier3Min}+ Jeton`, label: "HALAYBAŞI OL!", emoji: "👑", best: true },
    ];
    ladder.innerHTML = `<span class="ladder-rib" id="ladder-rib">HEDİYE GÖNDER, DÜĞÜNÜ YÖNET</span>` +
      rungs.map((r) => `
        <div class="rung${r.best ? " best" : ""}" id="rung-${r.tier}" data-coins="${esc(r.coins)}">
          <img class="rung-icon" referrerpolicy="no-referrer" src="${GIFT_ICONS[r.tier]}" alt="" onerror="this.outerHTML='<span class=rung-emoji>${r.emoji}</span>'" />
          <div class="rung-tx">
            <small>${esc(r.coins)}</small>
            <b>${esc(r.label)}</b>
          </div>
        </div>
      `).join("");
  }

  flashLadderTier(tierName, nickname) {
    this.lastGiftTs = Date.now();
    const num = tierName === "boss" ? 3 : (tierName === "medium" ? 2 : 1);
    const el = document.getElementById(`rung-${num}`);
    if (!el) return;
    const sm = el.querySelector("small");
    if (sm) sm.textContent = `${String(nickname || "Misafir").slice(0, 12)}!`;
    el.classList.remove("hit");
    void el.offsetWidth;
    el.classList.add("hit");
    clearTimeout(this.hitTimers[num]);
    this.hitTimers[num] = setTimeout(() => {
      if (sm) sm.textContent = el.dataset.coins;
      el.classList.remove("hit");
    }, 2600);
  }

  _startTicker() {
    const el = document.getElementById("hud-ticker");
    if (!el) return;
    const step = () => {
      const r = TICKER_RULES[this.tickerIdx++ % TICKER_RULES.length];
      el.classList.add("fade");
      setTimeout(() => {
        el.innerHTML = `<span>${r.icon}</span><span class="tk-txt">${esc(r.text)}</span><span class="tk-tag">${esc(r.tag)}</span>`;
        el.classList.remove("fade");
      }, 200);
    };
    step();
    setInterval(step, 3600);
  }

  setModeHeader(modeKey) {
    this.sceneMode = modeKey;
    const m = MODE_LABELS[modeKey] || MODE_LABELS.kirdgunu_ring;
    const tEl = document.getElementById("hud-mode-title");
    const sEl = document.getElementById("hud-mode-sub");
    if (tEl) tEl.textContent = m.title;
    if (sEl) sEl.textContent = m.sub;
    const bar2Wrap = document.getElementById("gbar-second");
    if (bar2Wrap) bar2Wrap.classList.toggle("versus", modeKey === "kapisma");
  }

  updateNowPlaying(track, isPlaying, isLoading, bars = [0.3, 0.6, 0.4, 0.8], requestedBy = "") {
    const titleEl = document.getElementById("hud-np-title");
    const idxEl = document.getElementById("hud-np-idx");
    const pillEl = document.getElementById("hud-music-pill");
    const toggleBtn = document.getElementById("hud-btn-play");
    if (pillEl) {
      pillEl.classList.toggle("playing", !!isPlaying);
      pillEl.classList.toggle("muted", !isPlaying && !isLoading);
    }
    if (toggleBtn) {
      toggleBtn.textContent = isLoading ? "⏳" : (isPlaying ? "🔊" : "🔇");
    }
    if (idxEl) {
      idxEl.textContent = track ? `#${track.index}/100` : "100 HALAY";
    }
    if (titleEl) {
      const prefix = requestedBy ? `🎧 ${requestedBy}: ` : "";
      titleEl.textContent = track ? `${prefix}${track.title}` : "100 Halay Seçkisi Hazır";
    }
    const bocekNp = document.getElementById("bocek-np-title");
    if (bocekNp && track?.title) {
      const prefix = requestedBy ? `🎧 ${requestedBy}: ` : "";
      bocekNp.textContent = `${prefix}${track.title}`;
    }
    const eqSpans = document.querySelectorAll(".eq-Visualizer i");
    eqSpans.forEach((el, i) => {
      const h = Math.round((bars[i % bars.length] || 0.2) * 100);
      el.style.height = `${Math.max(18, h)}%`;
    });
  }

  updateCombo(comboCount) {
    const el = document.getElementById("hud-combo-pill");
    if (!el) return;
    if (!comboCount || comboCount < 3) {
      el.classList.add("hidden");
      return;
    }
    el.classList.remove("hidden");
    el.classList.toggle("fever", comboCount >= 15);
    el.textContent = comboCount >= 15 ? `🔥 x${comboCount} MEYDAN FEVER!` : `⚡ x${comboCount} COMBO`;
  }

  updateCounters(dancerCount, goalTarget, goalsHit, bpm, heatFrac, teamScores) {
    const cNum = document.getElementById("hud-big-count");
    if (cNum && cNum.textContent !== String(dancerCount)) {
      cNum.textContent = String(dancerCount);
      cNum.classList.remove("bump");
      void cNum.offsetWidth;
      cNum.classList.add("bump");
    }
    const pStat = document.getElementById("hud-stat-players");
    if (pStat) pStat.innerHTML = `<b>${dancerCount}</b> katılımcı`;

    const mult = (bpm / 118).toFixed(1);
    const tStat = document.getElementById("hud-stat-tempo");
    if (tStat) tStat.innerHTML = `Tempo <b>x${mult}</b>`;
    const tPill = document.getElementById("hud-pill-tempo");
    if (tPill) tPill.classList.toggle("hot", heatFrac > 0.65);

    const winsEl = document.getElementById("hud-wins");
    if (winsEl) {
      winsEl.classList.toggle("hidden", goalsHit < 1);
      winsEl.innerHTML = `🏆 <b>${goalsHit}</b> TUR AŞILDI`;
    }

    const gFill = document.getElementById("bar-goal-fill");
    const gTxt = document.getElementById("bar-goal-txt");
    const gFrac = Math.min(1, dancerCount / Math.max(1, goalTarget));
    if (gFill) gFill.style.width = `${(gFrac * 100).toFixed(1)}%`;
    if (gTxt) gTxt.textContent = `HEDEF HALAY · ${dancerCount}/${goalTarget}`;

    const hFill = document.getElementById("bar-heat-fill");
    const hTxt = document.getElementById("bar-heat-txt");
    if (this.sceneMode === "kapisma" && teamScores) {
      const gScore = teamScores.gelin || 0;
      const dScore = teamScores.damat || 0;
      const tot = gScore + dScore;
      const frac = tot > 0 ? gScore / tot : 0.5;
      if (hFill) hFill.style.width = `${(frac * 100).toFixed(1)}%`;
      if (hTxt) hTxt.textContent = `GELİN ${gScore} ⚔️ ${dScore} DAMAT`;
    } else {
      const pct = Math.round(Math.min(1, heatFrac) * 100);
      if (hFill) hFill.style.width = `${pct}%`;
      if (hTxt) hTxt.textContent = heatFrac > 0.75 ? "🔥 DAVUL COŞTU!" : `DÜĞÜN COŞKUSU · %${pct}`;
    }
  }

  updateLeaderboard(rows = []) {
    const box = document.getElementById("hud-podium");
    if (!box) return;
    if (!rows.length) {
      box.innerHTML = "";
      return;
    }
    const medals = ["🥇", "🥈", "🥉"];
    box.innerHTML = rows.slice(0, 3).map((r, i) => {
      const fb = generateAvatarDataUrl(r.nickname || "M");
      const av = r.avatar || fb;
      return `<div class="pchip"><span>${medals[i]}</span><img referrerpolicy="no-referrer" src="${esc(av)}" onerror="this.src='${fb}'" alt="" /><span class="nm">${esc(r.nickname)}</span><span class="sc">${r.score}</span></div>`;
    }).join("");
  }

  updateHalaybasi(leader) {
    const box = document.getElementById("hud-leader");
    if (!box) return;
    if (!leader || !leader.nickname) {
      box.classList.add("hidden");
      return;
    }
    box.classList.remove("hidden");
    const fb = generateAvatarDataUrl(leader.nickname);
    const av = leader.avatar || fb;
    box.innerHTML = `<img referrerpolicy="no-referrer" src="${esc(av)}" onerror="this.src='${fb}'" alt="" /><div><small>👑 HALAYBAŞI</small><strong>${esc(leader.nickname)}</strong></div>`;
  }

  showPopBanner(bigText, subText = "", color = "#ffd23f") {
    const el = document.getElementById("hud-pop-banner");
    if (!el) return;
    el.style.setProperty("--callout", color);
    el.innerHTML = `<span class="pop-big">${esc(bigText)}</span>${subText ? `<span class="pop-sub">${esc(subText)}</span>` : ""}`;
    el.classList.remove("show");
    void el.offsetWidth;
    el.classList.add("show");
  }

  toggleSafeZone() {
    const el = document.getElementById("safe-zone-overlay");
    if (el) el.classList.toggle("hidden");
  }
}
