import * as THREE from "three";
import { createCockroachCharacter, generateAvatarDataUrl, HALAY_CHARACTER_POOL } from "./roach_factory.js?v=99";

const REAL_VIEWER_OUTFITS = HALAY_CHARACTER_POOL;

function resolveViewerOutfit(uid, explicitOutfit = "") {
  if (explicitOutfit && explicitOutfit !== "plain") return explicitOutfit;
  const s = String(uid || "guest");
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return REAL_VIEWER_OUTFITS[(h >>> 0) % REAL_VIEWER_OUTFITS.length];
}

const STARTER_WEDDING_CROWD = [
  { nickname: "Gül", outfit: "fez_yelek", coins: 500 },
  { nickname: "Zeynep", outfit: "kasket_yelek", coins: 0 },
  { nickname: "rubıes16", outfit: "kahve_kasket_yelek", coins: 0 },
  { nickname: "lale", outfit: "bindalli_pembe", coins: 0 },
  { nickname: "medine", outfit: "yesil_yazma_bindalli", coins: 0 },
  { nickname: "boş_", outfit: "sari_yazma_bindalli", coins: 0 },
  { nickname: "KİNYASS", outfit: "fez_yelek", coins: 0 },
  { nickname: "Yigitt", outfit: "kasket_yelek", coins: 0 },
  { nickname: "Derya", outfit: "bindalli_pembe", coins: 1249 },
  { nickname: "toprak", outfit: "takim_elbise", coins: 0 },
  { nickname: "ysf/media", outfit: "yazmali_anne", coins: 0 },
  { nickname: "Sude Tezer", outfit: "pala_biyik_atlet", coins: 0 },
  { nickname: "Talha_stgt", outfit: "mavi_gomlek", coins: 0 },
  { nickname: "ikra", outfit: "beyaz_tisort", coins: 0 },
  { nickname: "asy", outfit: "doktor_onluk", coins: 4 },
  { nickname: "elif", outfit: "pembe_fiyonk", coins: 0 },
  { nickname: "ARENA", outfit: "zincirli_keko", coins: 0 },
  { nickname: "duygu", outfit: "kareli_onluk", coins: 0 },
  { nickname: "Mustafa Onur", outfit: "sapkali_cocuk", coins: 550 },
  { nickname: "KUMSALL", outfit: "klasik_bocek", coins: 0 },
  { nickname: "begum", outfit: "bindalli_pembe", coins: 0 },
  { nickname: "BUGRA", outfit: "fez_yelek", coins: 0 },
  { nickname: "Asu", outfit: "yesil_yazma_bindalli", coins: 0 },
  { nickname: "KUMRAL", outfit: "kasket_yelek", coins: 0 },
  { nickname: "STİTCH", outfit: "kahve_kasket_yelek", coins: 0 },
  { nickname: "ecrin", outfit: "sari_yazma_bindalli", coins: 0 },
  { nickname: "pastinty", outfit: "takim_elbise", coins: 0 },
  { nickname: "HİLOŞ★FANS", outfit: "yazmali_anne", coins: 0 },
  { nickname: "Ela", outfit: "pembe_fiyonk", coins: 0 },
  { nickname: "ali21_38", outfit: "pala_biyik_atlet", coins: 0 },
  { nickname: "zehraaa", outfit: "bindalli_pembe", coins: 0 },
  { nickname: "sareyy", outfit: "mavi_gomlek", coins: 0 },
  { nickname: "Astronomi", outfit: "doktor_onluk", coins: 0 },
  { nickname: "Mehmet Tra...", outfit: "fez_yelek", coins: 1090 },
  { nickname: "Yusuf", outfit: "kasket_yelek", coins: 599 },
  { nickname: "Kübra", outfit: "yesil_yazma_bindalli", coins: 530 },
  { nickname: "Ömer_beşir", outfit: "zincirli_keko", coins: 0 },
  { nickname: "Aslınur", outfit: "beyaz_tisort", coins: 0 },
];

const LAWN_BANTER_LINES = [
  "Kaynana hiç gülmüyor.",
  "Burdayım burda!",
  "Pasta ne zaman gelecek?",
  "Altınları kim topladı?",
  "Limonata bile ısınmış.",
  "Oğlan evi nerde kaldı?",
  "Takı kurdelesi doldu maşallah!",
  "Kız evi çok havalı.",
];

const RING_BANTER_LINES = [
  "Hevaasa",
  "Heyy",
  "bu nedir",
  "Tey tey tey!",
  "Halaybaşı uçuyor!",
  "Ayağıma bastın 😂",
  "Mendili bana ver!",
  "Hobaaa!",
  "Sıkıştır halayı!",
  "Damat terledi!",
  "Maşallah size",
  "Burası yıkılıyor 🔥",
];

export class HalayController {
  constructor(scene, labelsLayer, worldFX) {
    this.scene = scene;
    this.labelsLayer = labelsLayer;
    this.worldFX = worldFX;

    this.dancers = [];
    this.dancerMap = new Map();
    this.spectators = [];
    this.spectatorMap = new Map();
    this.maxSpectators = 18;
    this.bgGuests = [];
    this.musicians = [];
    this.sceneMode = "kirdgunu_ring"; // kirdgunu_ring | halay_snake | horon | kapisma
    this.avatarStyle = "roach"; // roach | villager | mixed
    this.minRingDancers = 0; // Tris: Strict Zero-Mock policy! No bot/dummy cockroaches, real viewers only!
    this.ambientCrowdEnabled = false;
    this.starterCrowdEnabled = false;
    this.demoNamesEnabled = false;
    this.ambientBanterEnabled = false;
    this.ringAngle = 0;
    this.beatPhase = 0;
    this.halayBeats = 0;
    this.snakeBeat = 0;
    this.squeezeFactor = 1.0;
    this.tempoGear = "orta";
    this.tempoGearMult = 1.0;
    this._projVec = new THREE.Vector3();
    this._tmpVec = new THREE.Vector3();
    this._recentBubbles = new Map();
    this._viewerSpeakerMap = new Map();
    this._lastRealChatTs = 0;
    this._banterCooldown = 0.65;
    this._banterStep = 0;
    this.wobbleTimer = 0;

    this._buildSnakeCurve();
    this._buildSpotlights();
    this._spawnBrideAndGroom();
    this._spawnMusicians();
    if (this.ambientCrowdEnabled) {
      this._spawnAmbientLawnGuests();
      this.seedStarterCrowd(48);
    }
  }

  _buildSnakeCurve() {
    // 4-row S-winding serpentine Meydan Halayı curve facing the camera (ported from OmniReverse Halay SDK)
    const xs = 7.2;
    const rows = [4.2, 0.8, -2.6, -6.0];
    const pts = [new THREE.Vector3(xs + 1.2, 0, rows[0])];
    for (let r = 0; r < rows.length; r++) {
      const dir = r % 2 ? 1 : -1;
      const z = rows[r];
      pts.push(
        new THREE.Vector3(-dir * xs * 0.35, 0, z),
        new THREE.Vector3(dir * xs * 0.35, 0, z),
        new THREE.Vector3(dir * xs, 0, z)
      );
      if (r < rows.length - 1) {
        pts.push(new THREE.Vector3(dir * (xs + 1.1), 0, (z + rows[r + 1]) * 0.5));
      }
    }
    pts.push(new THREE.Vector3(xs + 1.8, 0, rows[rows.length - 1]));
    this.snakeCurve = new THREE.CatmullRomCurve3(pts, false, "centripetal");
    this.snakePoints = this.snakeCurve.getSpacedPoints(600);
    this.snakeLen = this.snakeCurve.getLength();
  }

  _buildSpotlights() {
    const coneGeo = new THREE.ConeGeometry(1.15, 7.5, 20, 1, true);
    const coneMat = new THREE.MeshBasicMaterial({
      color: 0xfff1b8,
      transparent: true,
      opacity: 0.2,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.spotPool = [0, 1, 2].map(() => {
      const m = new THREE.Mesh(coneGeo, coneMat);
      m.visible = false;
      this.scene.add(m);
      return m;
    });
  }

  _createSashRibbon(isBride = true) {
    // Attached directly to rig.chestDecor (mixamorigSpine2) so sash & pinned gold move 1:1 with torso!
    const sashGroup = new THREE.Group();
    const ribbonMat = new THREE.MeshStandardMaterial({
      color: 0xdc2626,
      emissive: 0x55060c,
      roughness: 0.32,
      metalness: 0.14,
      side: THREE.DoubleSide,
    });

    const dir = isBride ? 1 : -1;
    // Contoured 3D diagonal satin sash crossing visibly ON TOP of front chest from shoulder to hip
    const sashCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-dir * 0.17, 0.19, 0.02),
      new THREE.Vector3(-dir * 0.15, 0.18, 0.17),
      new THREE.Vector3(-dir * 0.06, 0.08, 0.245),
      new THREE.Vector3(dir * 0.05, -0.04, 0.250),
      new THREE.Vector3(dir * 0.16, -0.16, 0.19),
      new THREE.Vector3(dir * 0.17, -0.18, 0.03),
    ]);
    const sashMesh = new THREE.Mesh(new THREE.TubeGeometry(sashCurve, 22, 0.030, 10, false), ribbonMat);
    sashGroup.add(sashMesh);

    // Hanging satin ribbon tails at the hip knot
    const tailGeo = new THREE.BoxGeometry(0.048, 0.22, 0.010);
    const tail1 = new THREE.Mesh(tailGeo, ribbonMat);
    tail1.position.set(dir * 0.16, -0.25, 0.19);
    tail1.rotation.z = dir * 0.20;
    const tail2 = new THREE.Mesh(tailGeo, ribbonMat);
    tail2.position.set(dir * 0.19, -0.26, 0.18);
    tail2.rotation.z = dir * 0.38;
    sashGroup.add(tail1, tail2);

    // Gold rosette pin knot at sash hip cross
    const knotMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.038, 10, 10),
      new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.88, roughness: 0.18 })
    );
    knotMesh.position.set(dir * 0.16, -0.15, 0.20);
    sashGroup.add(knotMesh);

    // Exact 3D anchor on front chest where gifters reach their right hand to pin gold/cash
    const pinAnchor = new THREE.Object3D();
    pinAnchor.position.set(0, 0.03, 0.275);
    sashGroup.add(pinAnchor);

    const pinnedContainer = new THREE.Group();
    sashGroup.add(pinnedContainer);

    return {
      group: sashGroup,
      pinAnchor,
      pinnedContainer,
      items: [],
      pinItem: (type = "gold") => {
        const count = sashGroup.userData.itemsCount || 0;
        if (count >= 16) return;
        sashGroup.userData.itemsCount = count + 1;

        const t = Math.min(0.86, 0.20 + (count % 8) * 0.092);
        const rowShift = Math.floor(count / 8) * 0.046;
        const pt = sashCurve.getPoint(t);
        const px = pt.x + (rowShift * dir);
        const py = pt.y;
        const pz = pt.z + 0.032 + (count % 3) * 0.006;

        if (type === "cash") {
          const bill = new THREE.Mesh(
            new THREE.PlaneGeometry(0.115, 0.062),
            new THREE.MeshStandardMaterial({
              color: 0x16a34a,
              emissive: 0x052e16,
              roughness: 0.38,
              side: THREE.DoubleSide,
            })
          );
          bill.position.set(px, py, pz);
          bill.rotation.set(-0.08, 0, count % 2 === 0 ? 0.18 : -0.18);
          pinnedContainer.add(bill);
        } else {
          const coinGroup = new THREE.Group();
          const coin = new THREE.Mesh(
            new THREE.CylinderGeometry(0.040, 0.040, 0.012, 16),
            new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.92, roughness: 0.14 })
          );
          coin.rotation.x = Math.PI / 2;
          coinGroup.add(coin);

          const miniRibbon = new THREE.Mesh(
            new THREE.BoxGeometry(0.015, 0.042, 0.005),
            ribbonMat
          );
          miniRibbon.position.set(0, 0.028, -0.004);
          coinGroup.add(miniRibbon);

          coinGroup.position.set(px, py, pz);
          pinnedContainer.add(coinGroup);
        }
      },
    };
  }

  _spawnBrideAndGroom() {
    this.coupleGroup = new THREE.Group();
    this.coupleGroup.position.set(0, 0.11, -0.55);

    // Bride & Groom on raised red stage with bone-attached 3D Red Satin Sashes!
    this.brideRig = createCockroachCharacter({ outfit: "bride" });
    this.brideRig.root.position.set(-0.44, 0, 0);
    this.brideRig.root.rotation.y = 0.22;
    this.brideRig.root.visible = true;
    this.brideSash = this._createSashRibbon(true);
    this.brideRig.chestDecor.add(this.brideSash.group);

    this.groomRig = createCockroachCharacter({ outfit: "groom" });
    this.groomRig.root.position.set(0.44, 0, 0);
    this.groomRig.root.rotation.y = -0.22;
    this.groomRig.root.visible = true;
    this.groomSash = this._createSashRibbon(false);
    this.groomRig.chestDecor.add(this.groomSash.group);

    this.coupleGroup.add(this.brideRig.root, this.groomRig.root);
    this.scene.add(this.coupleGroup);

    // Pink-magenta VIP role badges above Bride ("GELİN") & Groom ("DAMAT") matching 11692FonWDI
    this.coupleDom = {};
    [
      { key: "gelin", icon: "👰", defaultNick: "Merve", defaultCoins: 258 },
      { key: "damat", icon: "🤵", defaultNick: "Esra Karad...", defaultCoins: 448 },
    ].forEach((cfg) => {
      const anchor = document.createElement("div");
      anchor.className = "roach-anchor";
      const bubble = document.createElement("div");
      bubble.className = "speech-bubble hidden";
      anchor.appendChild(bubble);

      const plate = document.createElement("div");
      plate.className = "nameplate couple-vip hidden-plate";
      plate.innerHTML = `<span class="cv-diamond">♦</span><span class="cv-icon">${cfg.icon}</span><span class="cv-name">${cfg.defaultNick}</span><span class="cv-coin">🪙 <b>${cfg.defaultCoins}</b></span>`;
      anchor.appendChild(plate);
      this.labelsLayer.appendChild(anchor);

      this.coupleDom[cfg.key] = {
        anchor,
        bubble,
        plate,
        assignedNick: "",
        assignedCoins: 0,
        bubbleTimer: 0,
      };
    });
  }

  assignCoupleRole(role, user, coins = 99) {
    const slot = this.coupleDom?.[role];
    if (!slot) return;
    const targetRig = role === "gelin" ? this.brideRig : this.groomRig;
    if (!user || !user.nickname) {
      slot.assignedNick = "";
      slot.assignedCoins = 0;
      if (targetRig) targetRig.root.visible = true;
      if (!this.demoNamesEnabled) slot.plate.classList.add("hidden-plate");
      return;
    }
    if (targetRig) targetRig.root.visible = true;
    slot.assignedNick = user.nickname;
    slot.assignedCoins = user.coins || coins || 99;
    const nm = slot.plate.querySelector(".cv-name");
    const cn = slot.plate.querySelector(".cv-coin b");
    if (nm) nm.textContent = user.nickname.slice(0, 14);
    if (cn) cn.textContent = String(slot.assignedCoins);
    slot.plate.classList.remove("hidden-plate");
    slot.bubble.classList.add("hidden");
    slot.bubbleTimer = 0;
  }

  _spawnMusicians() {
    // Authentic Anatolian Wedding Musicians (Davulcu & Zurnacı) flanking the red stage in full 9:16 view
    this.musiciansGroup = new THREE.Group();
    const spots = [
      { role: "davulcu", outfit: "fez_yelek", inst: "davul", x: -1.62, z: -0.78, ry: 0.24, scale: 1.02, vipSlot: true },
      { role: "zurnaci", outfit: "kasket_yelek", inst: "zurna", x: 1.62, z: -0.78, ry: -0.24, scale: 1.02, vipSlot: true },
    ];
    spots.forEach((cfg, idx) => {
      const rig = createCockroachCharacter({ outfit: cfg.outfit, instrument: cfg.inst });
      rig.root.position.set(cfg.x, 0, cfg.z);
      rig.root.rotation.y = cfg.ry;
      rig.root.scale.setScalar(cfg.scale);
      rig.root.visible = true;
      this.musiciansGroup.add(rig.root);

      let domAnchor = null;
      let domBubble = null;
      let domPlate = null;
      let domRoleTag = null;
      let domNameSpan = null;
      let domBadge = null;

      if (cfg.vipSlot) {
        domAnchor = document.createElement("div");
        domAnchor.className = "roach-anchor";
        domBubble = document.createElement("div");
        domBubble.className = "speech-bubble hidden";
        domAnchor.appendChild(domBubble);

        domPlate = document.createElement("div");
        domPlate.className = "nameplate boss hidden-plate";

        domBadge = document.createElement("div");
        domBadge.className = "livedeck-avatar-badge";
        domBadge.style.backgroundColor = cfg.role === "davulcu" ? "#f59e0b" : "#ec4899";
        domBadge.textContent = cfg.role === "davulcu" ? "🥁" : "🎺";

        const labelStack = document.createElement("div");
        labelStack.className = "livedeck-label-stack";

        domRoleTag = document.createElement("div");
        domRoleTag.className = "livedeck-role-tag";
        domRoleTag.textContent = cfg.role === "davulcu" ? "🥁 DAVULCU" : "🎺 ZURNACI";
        labelStack.appendChild(domRoleTag);

        domNameSpan = document.createElement("span");
        domNameSpan.textContent = "";
        labelStack.appendChild(domNameSpan);

        domPlate.append(domBadge, labelStack);
        domAnchor.appendChild(domPlate);
        this.labelsLayer.appendChild(domAnchor);
      }

      this.musicians.push({
        role: cfg.role,
        vipSlot: cfg.vipSlot,
        assignedUid: "",
        assignedNick: "",
        baseX: cfg.x,
        baseZ: cfg.z,
        baseRy: cfg.ry,
        phaseOffset: idx * 0.85,
        rig,
        domAnchor,
        domBubble,
        domPlate,
        domRoleTag,
        domNameSpan,
        domBadge,
        bubbleTimer: 0,
      });
    });
    this.scene.add(this.musiciansGroup);
  }

  assignMusicianRole(role, user) {
    const mus = this.musicians.find((m) => m.vipSlot && m.role === role);
    if (!mus || !mus.domPlate) return;
    if (!user || !user.nickname) {
      mus.assignedUid = "";
      mus.assignedNick = "";
      if (mus.rig?.root) mus.rig.root.visible = true;
      mus.domPlate.classList.add("hidden-plate");
      return;
    }
    if (mus.rig?.root) mus.rig.root.visible = true;
    const prevUid = mus.assignedUid;
    mus.assignedUid = user.uid || user.nickname;
    mus.assignedNick = user.nickname;
    if (mus.domNameSpan) mus.domNameSpan.textContent = user.nickname;
    if (mus.domBadge) mus.domBadge.textContent = (user.nickname[0] || "V").toUpperCase();
    mus.domPlate.classList.remove("hidden-plate");
    if (mus.domBubble) {
      mus.domBubble.classList.add("hidden");
      mus.bubbleTimer = 0;
    }
  }

  setTempoGear(gear) {
    const map = { yavas: 0.84, orta: 1.0, hizli: 1.24, cosku: 1.48 };
    if (map[gear]) {
      this.tempoGear = gear;
      this.tempoGearMult = map[gear];
    }
  }

  showAnnouncerBubble(text) {
    const clean = String(text || "").trim().slice(0, 82);
    if (!clean) return;
    const boss = this.dancers.find((d) => d.rig.isHalaybasi()) || this.dancers[0];
    if (boss && boss.domBubble) {
      boss.domBubble.textContent = `🎙️ ${clean}`;
      boss.domBubble.classList.remove("hidden", "fading");
      boss.bubbleTimer = 6.5;
      return;
    }
    const mus = this.musicians.find((m) => m.vipSlot && m.domBubble);
    if (mus && mus.domBubble) {
      mus.domBubble.textContent = `🎙️ ${clean}`;
      mus.domBubble.classList.remove("hidden", "fading");
      mus.bubbleTimer = 6.5;
    }
  }

  pinBrideGroomGold(type = "gold", count = 1, role = null) {
    for (let i = 0; i < count; i++) {
      const isBride = (role === "gelin" || (!role && i % 2 === 0));
      const targetSash = isBride ? this.brideSash : this.groomSash;
      if (targetSash) {
        targetSash.pinItem(type);
      }
      if (isBride) this.brideRig.pinGoldCoin();
      else this.groomRig.pinGoldCoin();
    }
    const fxPos = role === "damat" ? new THREE.Vector3(0.48, 1.4, -0.4) : new THREE.Vector3(-0.48, 1.4, -0.4);
    this.worldFX.spawnCelebration(fxPos, 42, true);
  }

  _makeCharacterRig(options = {}, _indexHint = 0) {
    return createCockroachCharacter(options);
  }

  setAvatarStyle(style) {
    if (!["roach", "villager", "mixed"].includes(style) || style === this.avatarStyle) return;
    this.avatarStyle = style;
    const swapActorRig = (actor, idx) => {
      const wasBoss = actor.rig.isHalaybasi();
      const oldPos = actor.rig.root.position.clone();
      const oldRot = actor.rig.root.rotation.y;
      this.scene.remove(actor.rig.root);

      const newRig = this._makeCharacterRig({ outfit: wasBoss ? "halaybasi" : actor.outfit, team: actor.team }, idx);
      if (wasBoss) newRig.upgradeToHalaybasi();
      for (let c = 0; c < (actor.coinsPinned || 0); c++) newRig.pinGoldCoin();
      newRig.root.position.copy(oldPos);
      newRig.root.rotation.y = oldRot;
      this.scene.add(newRig.root);
      actor.rig = newRig;
    };
    this.dancers.forEach((d, idx) => swapActorRig(d, idx));
    this.spectators.forEach((sp, idx) => swapActorRig(sp, idx + 100));
  }

  setSceneMode(mode) {
    if (!["kirdgunu_ring", "halay_snake", "horon", "zeybek", "kapisma"].includes(mode)) return;
    this.sceneMode = mode;
    this.coupleGroup.visible = mode !== "halay_snake";
    if (mode === "kapisma") {
      this.dancers.forEach((d, idx) => {
        if (!d.team) {
          d.team = idx % 2 === 0 ? "gelin" : "damat";
          d.rig.setTeamRibbon(d.team);
        }
      });
    }
  }

  _spawnAmbientLawnGuests() {
    const spots = [
      [-5.1, -18.1, 0.42, "straw_hat"],
      [-4.4, -18.4, -0.28, "plain"],
      [-2.3, -18.6, 0.14, "yellow_dress"],
      [1.7, -18.4, -0.12, "white_fur"],
      [4.5, -18.2, 0.22, "pink_hat"],
    ];
    spots.forEach(([x, z, ry, outfit], idx) => {
      const rig = createCockroachCharacter({ outfit });
      rig.root.position.set(x, 0, z);
      rig.root.rotation.y = ry;
      rig.root.scale.setScalar(0.72);
      this.scene.add(rig.root);

      const anchor = document.createElement("div");
      anchor.className = "roach-anchor guest-only";
      const bubble = document.createElement("div");
      bubble.className = "speech-bubble hidden";
      anchor.appendChild(bubble);
      this.labelsLayer.appendChild(anchor);

      this.bgGuests.push({
        uid: `lawn_guest_${idx}`,
        isLawnGuest: true,
        rig,
        domAnchor: anchor,
        domBubble: bubble,
        bubbleTimer: 0,
        screenX: 0,
        screenY: 0,
      });
    });
  }

  _evictOneStarter() {
    const idx = this._pickSpacedStarterIndex();
    if (idx < 0) return false;
    const st = this.dancers[idx];
    this.scene.remove(st.rig.root);
    if (st.domAnchor?.parentNode) st.domAnchor.parentNode.removeChild(st.domAnchor);
    this.dancers.splice(idx, 1);
    this.dancerMap.delete(st.uid);
    return true;
  }

  _pickSpacedStarterIndex() {
    const n = this.dancers.length;
    if (n === 0) return -1;
    const starterIndices = [];
    const realIndices = [];
    for (let i = 0; i < n; i++) {
      if (this.dancers[i].isStarter) starterIndices.push(i);
      else realIndices.push(i);
    }
    if (starterIndices.length === 0) return -1;
    if (realIndices.length === 0) {
      // First real viewer takes upper-right/back slot where face & badge are crystal clear above couple
      const pref = Math.min(n - 1, Math.floor(n * 0.68));
      return this.dancers[pref]?.isStarter ? pref : starterIndices[0];
    }
    // Space real viewers around the 360° ring (~3 slots apart) so Livedeck badges never stack on top of each other
    let bestIdx = starterIndices[0];
    let bestScore = -999;
    for (const cand of starterIndices) {
      let minArc = n;
      for (const rIdx of realIndices) {
        const diff = Math.abs(cand - rIdx);
        const circDist = Math.min(diff, n - diff);
        if (circDist < minArc) minArc = circDist;
      }
      // Prefer spacing of ~2-4 dancers apart along the ring so they form a visible group without badge overlap
      const score = minArc >= 3 ? (100 - Math.abs(minArc - 3.5) * 8) : minArc * 15;
      if (score > bestScore) {
        bestScore = score;
        bestIdx = cand;
      }
    }
    return bestIdx;
  }

  _ensureMinimumHalayRing(minCount = 0) {
    if (minCount <= 0) return;
    let seq = 0;
    while (this.dancers.length < minCount) {
      const item = STARTER_WEDDING_CROWD[seq % STARTER_WEDDING_CROWD.length];
      const uid = `starter_ring_${seq++}`;
      if (this.dancerMap.has(uid)) continue;
      const rig = this._makeCharacterRig({ outfit: item.outfit }, this.dancers.length);
      const dom = this._createDomAnchor({ uid, nickname: item.nickname }, false);
      if (!this.demoNamesEnabled) {
        dom.plate.classList.add("hidden-plate");
      }
      const slot = this._computeFormationSlot(this.dancers.length, "", minCount);
      rig.root.position.set(slot.x, 0, slot.z);
      this.scene.add(rig.root);

      const dancer = {
        uid,
        nickname: item.nickname,
        outfit: item.outfit,
        team: "",
        isStarter: true,
        coinsPinned: 0,
        spotTimer: 0,
        rig,
        domAnchor: dom.anchor,
        domBubble: dom.bubble,
        domPlate: dom.plate,
        state: "dancing",
        jumpTimer: 0,
        bubbleTimer: 0,
        screenX: 0,
        screenY: 0,
      };
      this.dancers.push(dancer);
      this.dancerMap.set(uid, dancer);
    }
  }

  _claimStarterForViewer(user, wantBoss = false) {
    const uid = String(user?.uid || "").trim();
    if (!uid) return null;
    const idx = this._pickSpacedStarterIndex();
    if (idx < 0) return null;
    const st = this.dancers[idx];
    this.dancerMap.delete(st.uid);

    const hasBossAlready = this.dancers.some((d) => !d.isStarter && d.rig.isHalaybasi());
    const makeBoss = (wantBoss || user.outfit === "halaybasi" || !hasBossAlready) && !hasBossAlready;
    const outfit = makeBoss ? "halaybasi" : resolveViewerOutfit(uid, user.outfit);

    const oldPos = st.rig.root.position.clone();
    const oldRot = st.rig.root.rotation.y;
    this.scene.remove(st.rig.root);
    if (st.domAnchor?.parentNode) st.domAnchor.parentNode.removeChild(st.domAnchor);

    const newRig = this._makeCharacterRig({ outfit, team: user.team || st.team }, idx);
    if (makeBoss) newRig.upgradeToHalaybasi();
    newRig.root.position.copy(oldPos);
    newRig.root.rotation.y = oldRot;
    this.scene.add(newRig.root);

    const dom = this._createDomAnchor(user, newRig.isHalaybasi(), false);
    st.uid = uid;
    st.isStarter = false;
    st.nickname = user.nickname || "İzleyici";
    st.avatar = user.avatar || "";
    st.proxy_avatar = user.proxy_avatar || "";
    st.outfit = outfit;
    st.rig = newRig;
    st.domAnchor = dom.anchor;
    st.domBubble = dom.bubble;
    st.domPlate = dom.plate;
    st.jumpTimer = 0.95;
    st.spotTimer = 2.8;

    this.dancerMap.set(uid, st);
    return st;
  }

  seedStarterCrowd(count = 44) {
    if (!this.ambientCrowdEnabled) return;
    for (let i = 0; i < count; i++) {
      const item = STARTER_WEDDING_CROWD[i % STARTER_WEDDING_CROWD.length];
      const uid = `starter_wedding_${i}`;
      if (this.dancerMap.has(uid)) continue;
      const isBoss = i === 0;
      const rig = this._makeCharacterRig({ outfit: isBoss ? "halaybasi" : item.outfit }, this.dancers.length);
      if (isBoss) rig.upgradeToHalaybasi();
      const dom = this._createDomAnchor({ uid, nickname: item.nickname, coins: item.coins || 0 }, isBoss);
      if (!this.demoNamesEnabled) {
        dom.plate.classList.add("hidden-plate");
      }
      const slot = this._computeFormationSlot(this.dancers.length, "");
      rig.root.position.set(slot.x, 0, slot.z);
      this.scene.add(rig.root);

      const dancer = {
        uid,
        nickname: item.nickname,
        outfit: item.outfit,
        team: "",
        isStarter: true,
        coinsPinned: item.coins || 0,
        spotTimer: 0,
        rig,
        domAnchor: dom.anchor,
        domBubble: dom.bubble,
        domPlate: dom.plate,
        state: "dancing",
        jumpTimer: 0,
        bubbleTimer: 0,
        screenX: 0,
        screenY: 0,
      };
      this.dancers.push(dancer);
      this.dancerMap.set(uid, dancer);
    }
  }

  getRealDancerCount() {
    let n = 0;
    for (const d of this.dancers) {
      if (!d.isStarter) n++;
    }
    return n;
  }

  _clearAmbientLawnGuests() {
    for (const g of this.bgGuests) {
      this.scene.remove(g.rig.root);
      if (g.domAnchor?.parentNode) g.domAnchor.parentNode.removeChild(g.domAnchor);
    }
    this.bgGuests = [];
  }

  setDemoCrowdEnabled(enabled) {
    const on = !!enabled;
    this.ambientCrowdEnabled = on;
    this.starterCrowdEnabled = on;
    this.demoNamesEnabled = on;
    this.ambientBanterEnabled = on;
    if (!on) {
      while (this.dancers.length > this.minRingDancers && this._evictOneStarter()) { /* trim extra demo crowd */ }
      this._ensureMinimumHalayRing(this.minRingDancers);
      for (const d of this.dancers) {
        if (d.isStarter && d.domPlate) d.domPlate.classList.add("hidden-plate");
      }
      if (this.coupleDom) {
        if (!this.coupleDom.gelin?.assignedNick) {
          this.coupleDom.gelin?.plate.classList.add("hidden-plate");
        }
        if (!this.coupleDom.damat?.assignedNick) {
          this.coupleDom.damat?.plate.classList.add("hidden-plate");
        }
      }
      if (this.brideRig?.root) this.brideRig.root.visible = true;
      if (this.groomRig?.root) this.groomRig.root.visible = true;
      for (const m of this.musicians) {
        if (m.rig?.root) m.rig.root.visible = true;
        if (!m.assignedNick && m.domPlate) m.domPlate.classList.add("hidden-plate");
      }
      this._clearAmbientLawnGuests();
    } else {
      if (this.bgGuests.length === 0) this._spawnAmbientLawnGuests();
      if (this.dancers.filter((d) => d.isStarter).length < 32) this.seedStarterCrowd(45);
      for (const d of this.dancers) {
        if (d.isStarter && d.domPlate) d.domPlate.classList.remove("hidden-plate");
      }
      if (this.coupleDom) {
        this.coupleDom.gelin?.plate.classList.remove("hidden-plate");
        this.coupleDom.damat?.plate.classList.remove("hidden-plate");
      }
      if (this.brideRig?.root) this.brideRig.root.visible = true;
      if (this.groomRig?.root) this.groomRig.root.visible = true;
      for (const m of this.musicians) {
        if (m.rig?.root) m.rig.root.visible = true;
      }
    }
  }

  setStarterCrowdEnabled(enabled) {
    this.setDemoCrowdEnabled(enabled);
  }

  resetAll() {
    for (const d of this.dancers) {
      this.scene.remove(d.rig.root);
      if (d.domAnchor?.parentNode) d.domAnchor.parentNode.removeChild(d.domAnchor);
    }
    for (const sp of this.spectators) {
      this.scene.remove(sp.rig.root);
      if (sp.domAnchor?.parentNode) sp.domAnchor.parentNode.removeChild(sp.domAnchor);
    }
    this.dancers = [];
    this.dancerMap.clear();
    this.spectators = [];
    this.spectatorMap.clear();
    this._viewerSpeakerMap.clear();
    this._recentBubbles.clear();
    this.tempoGear = "orta";
    this.tempoGearMult = 1.0;
    this.assignMusicianRole("davulcu", null);
    this.assignMusicianRole("zurnaci", null);
    this.assignCoupleRole("gelin", null);
    this.assignCoupleRole("damat", null);
    this._ensureMinimumHalayRing(this.minRingDancers);
    if (this.ambientCrowdEnabled) {
      if (this.bgGuests.length === 0) this._spawnAmbientLawnGuests();
      this.seedStarterCrowd(45);
    } else {
      this._clearAmbientLawnGuests();
    }
  }

  _createDomAnchor(user, isBoss = false, isSpectator = false) {
    const anchor = document.createElement("div");
    anchor.className = "roach-anchor";

    const bubble = document.createElement("div");
    bubble.className = "speech-bubble hidden";
    anchor.appendChild(bubble);

    const plate = document.createElement("div");
    plate.className = isBoss ? "nameplate boss" : (isSpectator ? "nameplate spectator" : "nameplate");

    if (isBoss) {
      const crownEl = document.createElement("div");
      crownEl.className = "boss-crown-float";
      crownEl.textContent = "👑";
      plate.appendChild(crownEl);
    }

    const nick = (user.nickname || "Misafir").trim();
    const initial = (nick[0] || "M").toUpperCase();

    let hash = 0;
    for (let i = 0; i < nick.length; i++) hash = nick.charCodeAt(i) + ((hash << 5) - hash);
    const colorList = ["#8b5cf6", "#ec4899", "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#06b6d4"];
    const circleColor = isBoss ? "#dc2626" : colorList[Math.abs(hash) % colorList.length];

    const circleBadge = document.createElement("div");
    circleBadge.className = "livedeck-avatar-badge";
    circleBadge.style.backgroundColor = circleColor;
    if (user.avatar) {
      const avImg = document.createElement("img");
      avImg.referrerPolicy = "no-referrer";
      avImg.src = user.avatar;
      avImg.onerror = () => { circleBadge.textContent = initial; };
      circleBadge.appendChild(avImg);
    } else {
      circleBadge.textContent = initial;
    }

    const labelStack = document.createElement("div");
    labelStack.className = "livedeck-label-stack";

    const span = document.createElement("span");
    span.textContent = nick;
    labelStack.appendChild(span);

    const coinBadge = document.createElement("small");
    coinBadge.className = "plate-coin-tag" + ((user.coins > 0) ? "" : " hidden");
    coinBadge.textContent = user.coins > 0 ? `🪙 ${user.coins}` : "";

    plate.append(circleBadge, labelStack, coinBadge);
    anchor.appendChild(plate);
    this.labelsLayer.appendChild(anchor);
    return { anchor, bubble, plate, span, circleBadge, coinBadge };
  }

  _syncActorIdentity(actor, user) {
    if (!actor || !user || actor.isStarter || actor.isLawnGuest) return;
    if (user.nickname && user.nickname !== actor.nickname) {
      actor.nickname = user.nickname;
      const sp = actor.domPlate?.querySelector("span");
      if (sp) sp.textContent = user.nickname;
      const badge = actor.domPlate?.querySelector(".livedeck-avatar-badge");
      if (badge) {
        badge.textContent = (user.nickname[0] || "M").toUpperCase();
      }
    }
  }

  _computeSpectatorSlot(index, total) {
    const row = Math.floor(index / 9);
    const col = index % 9;
    const rowCount = Math.min(9, Math.max(1, total - row * 9));
    const spread = Math.min(9.6, Math.max(3.4, (rowCount - 1) * 1.18));
    const t = rowCount <= 1 ? 0 : (col / (rowCount - 1)) - 0.5;
    const x = t * spread;
    const z = -4.85 - row * 1.38 - Math.cos(t * Math.PI) * 0.65;
    return { x, z };
  }

  _removeSpectator(uid, destroySceneNodes = true) {
    const sp = this.spectatorMap.get(uid);
    if (!sp) return null;
    this.spectatorMap.delete(uid);
    const idx = this.spectators.indexOf(sp);
    if (idx >= 0) this.spectators.splice(idx, 1);
    if (destroySceneNodes) {
      this.scene.remove(sp.rig.root);
      if (sp.domAnchor?.parentNode) sp.domAnchor.parentNode.removeChild(sp.domAnchor);
    }
    return sp;
  }

  _ensureRealSpectator(user) {
    const uid = String(user?.uid || "").trim();
    if (!uid) return null;
    if (this.dancerMap.has(uid)) {
      const d = this.dancerMap.get(uid);
      this._syncActorIdentity(d, user);
      return d;
    }
    if (this.spectatorMap.has(uid)) {
      const existing = this.spectatorMap.get(uid);
      existing.lastChatTs = performance.now();
      this._syncActorIdentity(existing, user);
      return existing;
    }

    if (this.spectators.length >= this.maxSpectators) {
      const idlePool = this.spectators.filter((s) => s.bubbleTimer <= 0);
      const evictPool = idlePool.length > 0 ? idlePool : this.spectators;
      evictPool.sort((a, b) => (a.lastChatTs || 0) - (b.lastChatTs || 0));
      if (evictPool[0]) this._removeSpectator(evictPool[0].uid, true);
    }

    const outfit = resolveViewerOutfit(uid, user.outfit);
    const team = user.team || "";
    const rig = this._makeCharacterRig({ outfit, team }, this.spectators.length + 50);
    const dom = this._createDomAnchor(user, false, true);
    const slot = this._computeSpectatorSlot(this.spectators.length, this.spectators.length + 1);
    rig.root.position.set(slot.x, 0, slot.z);
    this.scene.add(rig.root);

    const sp = {
      uid,
      nickname: user.nickname || "İzleyici",
      avatar: user.avatar || "",
      proxy_avatar: user.proxy_avatar || "",
      outfit,
      team,
      isSpectator: true,
      isStarter: false,
      coinsPinned: 0,
      spotTimer: 0,
      rig,
      domAnchor: dom.anchor,
      domBubble: dom.bubble,
      domPlate: dom.plate,
      jumpTimer: 0.45,
      bubbleTimer: 0,
      lastChatTs: performance.now(),
      screenX: 0,
      screenY: 0,
    };
    this.spectators.push(sp);
    this.spectatorMap.set(uid, sp);
    return sp;
  }

  seedHalay(users) {
    const newlySeeded = [];
    users.forEach((u, idx) => {
      if (this.dancerMap.has(u.uid)) {
        this._syncActorIdentity(this.dancerMap.get(u.uid), u);
        return;
      }
      this._removeSpectator(u.uid, true);
      if (!u.isStarter && this.dancers.some((d) => d.isStarter)) {
        const claimed = this._claimStarterForViewer(u, idx === 0);
        if (claimed) {
          newlySeeded.push(claimed);
          return;
        }
      }
      const hasBossAlready = this.dancers.some((d) => !d.isStarter && d.rig.isHalaybasi());
      const outfit = idx === 0 && !hasBossAlready
        ? "halaybasi"
        : resolveViewerOutfit(u.uid, u.outfit);
      const rig = this._makeCharacterRig({ outfit, team: u.team }, this.dancers.length);
      if (outfit === "halaybasi") rig.upgradeToHalaybasi();
      const dom = this._createDomAnchor(u, rig.isHalaybasi(), false);
      const slot = this._computeFormationSlot(this.dancers.length, u.team);
      rig.root.position.set(slot.x, 0, slot.z);
      this.scene.add(rig.root);

      const dancer = {
        uid: u.uid,
        nickname: u.nickname,
        avatar: u.avatar || "",
        proxy_avatar: u.proxy_avatar || "",
        outfit,
        team: u.team || "",
        isStarter: !!u.isStarter,
        coinsPinned: 0,
        spotTimer: 0,
        rig,
        domAnchor: dom.anchor,
        domBubble: dom.bubble,
        domPlate: dom.plate,
        state: "dancing",
        jumpTimer: 0.65,
        bubbleTimer: 0,
        screenX: 0,
        screenY: 0,
      };
      if (rig.isHalaybasi()) this.dancers.unshift(dancer);
      else this.dancers.push(dancer);
      this.dancerMap.set(u.uid, dancer);
      if (!u.isStarter) newlySeeded.push(dancer);
    });
    if (newlySeeded.length > 0) {
      const latest = newlySeeded[newlySeeded.length - 1];
      if (latest.bubbleTimer <= 0) {
        latest.domBubble.textContent = "Halaydayım! 🕺";
        latest.domBubble.classList.remove("hidden", "fading");
        latest.bubbleTimer = 5.8;
      }
    }
    return newlySeeded;
  }

  joinHalay(users) {
    const newlyAdded = [];
    users.forEach((u, i) => {
      if (this.dancerMap.has(u.uid)) {
        const existing = this.dancerMap.get(u.uid);
        this._syncActorIdentity(existing, u);
        existing.jumpTimer = 1.1;
        existing.spotTimer = 2.8;
        newlyAdded.push(existing);
        return;
      }

      // Seamless Spectator -> Ring Dancer Promotion
      const promoted = this._removeSpectator(u.uid, false);
      if (promoted) {
        if (!u.isStarter && this.dancers.length > this.minRingDancers) this._evictOneStarter();
        this._syncActorIdentity(promoted, u);
        const team = u.team || promoted.team || (this.sceneMode === "kapisma" ? (this.dancers.length % 2 === 0 ? "gelin" : "damat") : "");
        if (team) {
          promoted.team = team;
          promoted.rig.setTeamRibbon(team);
        }
        promoted.isSpectator = false;
        promoted.domPlate.className = promoted.rig.isHalaybasi() ? "nameplate boss" : "nameplate";
        promoted.state = "dancing";
        promoted.jumpTimer = 1.1;
        promoted.spotTimer = 3.2;
        const repIdx = this._pickSpacedStarterIndex();
        if (repIdx >= 0) {
          const oldSt = this.dancers[repIdx];
          this.scene.remove(oldSt.rig.root);
          if (oldSt.domAnchor?.parentNode) oldSt.domAnchor.parentNode.removeChild(oldSt.domAnchor);
          this.dancerMap.delete(oldSt.uid);
          this.dancers[repIdx] = promoted;
        } else {
          this.dancers.push(promoted);
        }
        this.dancerMap.set(u.uid, promoted);
        newlyAdded.push(promoted);
        return;
      }

      if (!u.isStarter && this.dancers.some((d) => d.isStarter)) {
        const claimed = this._claimStarterForViewer(u);
        if (claimed) {
          claimed.state = "dancing";
          claimed.jumpTimer = 1.1;
          claimed.spotTimer = 3.2;
          newlyAdded.push(claimed);
          return;
        }
      }

      const hasBossAlready = this.dancers.some((d) => !d.isStarter && d.rig.isHalaybasi());
      const outfit = !hasBossAlready ? "halaybasi" : resolveViewerOutfit(u.uid, u.outfit);
      const team = u.team || (this.sceneMode === "kapisma" ? (this.dancers.length % 2 === 0 ? "gelin" : "damat") : "");
      const rig = this._makeCharacterRig({ outfit, team }, this.dancers.length);
      if (outfit === "halaybasi") rig.upgradeToHalaybasi();
      const dom = this._createDomAnchor(u, rig.isHalaybasi(), false);

      const slot = this._computeFormationSlot(this.dancers.length, team, this.dancers.length + 1);
      rig.root.position.set(slot.x, 0, slot.z);
      this.scene.add(rig.root);

      const dancer = {
        uid: u.uid,
        nickname: u.nickname,
        avatar: u.avatar || "",
        proxy_avatar: u.proxy_avatar || "",
        outfit,
        team,
        isStarter: false,
        coinsPinned: u.coins || 0,
        spotTimer: 3.2,
        rig,
        domAnchor: dom.anchor,
        domBubble: dom.bubble,
        domPlate: dom.plate,
        domCoinBadge: dom.coinBadge,
        state: "dancing",
        jumpTimer: 1.1,
        bubbleTimer: 0,
        screenX: 0,
        screenY: 0,
      };
      // ECC Memory Guard: If ring exceeds 70 dancers, trim oldest non-boss starter/idle dancer
      if (this.dancers.length >= 70) {
        const evictIdx = this.dancers.findIndex((d) => d.isStarter && !d.rig.isHalaybasi());
        if (evictIdx >= 0) {
          const oldD = this.dancers.splice(evictIdx, 1)[0];
          this.scene.remove(oldD.rig.root);
          if (oldD.domAnchor?.parentNode) oldD.domAnchor.parentNode.removeChild(oldD.domAnchor);
          this.dancerMap.delete(oldD.uid);
        }
      }
      this.dancers.push(dancer);
      this.dancerMap.set(u.uid, dancer);
      newlyAdded.push(dancer);
    });
    if (newlyAdded.length > 0) {
      const topOne = newlyAdded[0];
      if (!topOne.isStarter) {
        topOne.waveTimer = 1.25;
        this.activeWelcomeDancer = topOne;
        this.welcomeFocusTimer = 1.0;
        if (this.onNewDancerJoined) this.onNewDancerJoined(topOne);
      }
    }
    return newlyAdded;
  }

  _computeFormationSlot(index, dancerTeam = "", totalOverride = 0) {
    if (this.sceneMode === "halay_snake") {
      const stepCyc = this.snakeBeat % 3;
      const fr = stepCyc % 1;
      const sm = fr * fr * (3 - 2 * fr);
      const stepOff = stepCyc < 1 ? -sm * 0.25 : stepCyc < 2 ? -0.25 - sm * 0.25 : -0.5 + sm * 0.5;
      const uDist = 2.2 + index * 0.98 + stepOff;
      const f = Math.max(0, Math.min(599.99, (uDist / this.snakeLen) * 600));
      const idx = Math.floor(f);
      const pt = this._tmpVec.lerpVectors(this.snakePoints[idx], this.snakePoints[Math.min(600, idx + 1)], f - idx);
      return { x: pt.x, z: pt.z, ringIdx: 0, rem: index, inThisRing: this.dancers.length, isClosedRing: false, faceCamera: false };
    }

    const stepPulse = this.ringAngle + Math.sin(this.beatPhase * 0.5) * 0.04;

    if (this.sceneMode === "kapisma") {
      const team = dancerTeam || (index % 2 === 0 ? "gelin" : "damat");
      const sameTeam = this.dancers.filter((d, idx) => (d.team || (idx % 2 === 0 ? "gelin" : "damat")) === team);
      const localIdx = Math.max(0, sameTeam.indexOf(this.dancers[index]));
      const totalInTeam = Math.max(1, sameTeam.length);
      const centerX = team === "gelin" ? -2.9 : 2.9;
      const radius = (2.25 + Math.floor(localIdx / 12) * 0.95) * this.squeezeFactor;
      const gapAng = Math.min(0.96 / radius, (Math.PI * 2) / Math.max(1, totalInTeam));
      const span = (totalInTeam - 1) * gapAng;
      const theta = -Math.PI * 0.5 - span * 0.5 + localIdx * gapAng + Math.sin(stepPulse * 0.5) * 0.2;
      return {
        x: centerX + Math.cos(theta) * radius,
        z: -0.55 + Math.sin(theta) * radius * 0.9,
        ringIdx: team === "gelin" ? 10 : 20,
        rem: localIdx,
        inThisRing: totalInTeam,
        isClosedRing: false,
        faceCamera: false,
      };
    }

    // Contiguous Shoulder-to-Shoulder Anatolian Halay Formation Facing Bride & Groom at (0, 0, -0.55):
    // Dancers stand ~0.96m apart so neighbors physically link hands; arcs expand smoothly into a 360° ring.
    const totalCount = Math.max(1, totalOverride || this.dancers.length);
    let rem = index;
    let ringIdx = 0;
    let cap = 18;
    while (rem >= cap) {
      rem -= cap;
      ringIdx++;
      cap = ringIdx === 1 ? 24 : (ringIdx === 2 ? 30 : 34 + (ringIdx - 2) * 6);
    }
    const inThisRing = Math.min(cap, Math.max(1, totalCount - (index - rem)));
    const isZeybek = this.sceneMode === "zeybek";
    const baseR = isZeybek ? 3.45 : 3.18;
    const radialBreath = Math.cos((this.halayBeats || 0) * Math.PI * 0.5 + ringIdx) * (isZeybek ? 0.10 : 0.035);
    const radius = (baseR + ringIdx * 1.12 + radialBreath) * this.squeezeFactor;
    const speedMult = isZeybek ? 0.45 : (this.sceneMode === "horon" ? 1.35 : 1.0);
    const dir = ringIdx % 2 === 0 ? 1 : -0.85;

    const desiredArcSpacing = isZeybek ? 1.48 : 0.96;
    const maxGapAngle = desiredArcSpacing / radius;
    const isClosedRing = !isZeybek && (inThisRing * maxGapAngle >= Math.PI * 1.88);
    const stepAngle = isClosedRing ? (Math.PI * 2) / inThisRing : maxGapAngle;

    let theta;
    if (inThisRing === 1) {
      theta = -Math.PI * 0.38 - Math.sin(this.ringAngle * 0.65 * speedMult) * 0.24 * dir;
    } else if (isClosedRing) {
      theta = -Math.PI * 0.5 - this.ringAngle * 0.32 * dir * speedMult + rem * stepAngle;
    } else {
      const span = (inThisRing - 1) * stepAngle;
      const arcCenter = -Math.PI * 0.5 - Math.sin(this.ringAngle * 0.55 * speedMult) * 0.28 * dir;
      theta = (arcCenter - span * 0.5) + rem * stepAngle;
    }

    return {
      x: Math.cos(theta) * radius,
      z: -0.55 + Math.sin(theta) * radius * 0.88,
      ringIdx,
      rem,
      inThisRing,
      isClosedRing,
      faceCamera: false,
    };
  }

  applyUserCommand(user, cmdAction, teamChoice) {
    const target = this.dancerMap.get(user?.uid) || this.spectatorMap.get(user?.uid);
    if (!target) return;
    if (teamChoice) {
      target.team = teamChoice;
      target.rig.setTeamRibbon(teamChoice);
    }
    if (cmdAction === "jump" || cmdAction === "horon_burst") {
      target.jumpTimer = 1.35;
    } else if (cmdAction === "clap") {
      target.jumpTimer = 0.8;
      target.spotTimer = 2.5;
    } else if (cmdAction === "zeybek_pose") {
      target.zeybekTimer = 5.5;
      target.spotTimer = 4.0;
    }
  }

  triggerMassJump(squeeze = false) {
    if (squeeze) this.squeezeFactor = 0.78;
    this.dancers.forEach((d, i) => {
      d.jumpTimer = 0.95 + (i % 3) * 0.15;
    });
    this.spectators.forEach((sp, i) => {
      sp.jumpTimer = 0.75 + (i % 3) * 0.12;
    });
  }

  triggerWobble() {
    this.wobbleTimer = 2.4;
    this.dancers.forEach((d, i) => {
      d.wobblePhase = (i * 0.45) + Math.random() * 0.2;
    });
  }

  _getActiveBubbleActors() {
    const out = [];
    for (const d of this.dancers) {
      if (d.bubbleTimer > 0) out.push(d);
    }
    for (const sp of this.spectators) {
      if (sp.bubbleTimer > 0) out.push(sp);
    }
    for (const g of this.bgGuests) {
      if (g.bubbleTimer > 0) out.push(g);
    }
    return out;
  }

  _pickSpacedActor(pool) {
    if (!pool.length) return null;
    const active = this._getActiveBubbleActors();
    const candidates = pool.filter((a) => a.bubbleTimer <= 0);
    const searchPool = candidates.length > 0 ? candidates : pool;

    let best = null;
    let bestScore = -1;
    for (let k = 0; k < Math.min(12, searchPool.length); k++) {
      const cand = searchPool[Math.floor(Math.random() * searchPool.length)];
      let minDist = 9999;
      for (const act of active) {
        const d = Math.hypot((cand.screenX || 0) - (act.screenX || 0), (cand.screenY || 0) - (act.screenY || 0));
        if (d < minDist) minDist = d;
      }
      if (minDist > bestScore) {
        bestScore = minDist;
        best = cand;
      }
    }
    return best || searchPool[0];
  }

  showSpeechBubble(user, text, opts = {}) {
    const cleanText = String(text || "").trim().slice(0, 76);
    if (!cleanText) return;

    const uid = String(user?.uid || user?.nickname || "").trim();
    const now = performance.now();

    if (opts.isRealViewer) {
      if (!uid) return;
      this._lastRealChatTs = now;

      // Resolve real viewer actor: if already in halay ring, reuse; else join them into the halay ring immediately!
      let target = this.dancerMap.get(uid) || null;
      if (target) {
        this._syncActorIdentity(target, user);
      } else {
        target = this._claimStarterForViewer(user);
        if (!target) {
          const added = this.joinHalay([user]);
          target = added[0] || this._ensureRealSpectator(user);
        }
      }
      if (!target) return;

      // Consolidate live_feed (t=0ms) + chat (t=120ms) seamlessly without dropping or double-popping
      const dedupKey = `real::${uid}::${cleanText.toLowerCase()}`;
      const prevTs = this._recentBubbles.get(dedupKey) || 0;
      if (now - prevTs < 1100) {
        if (target.domBubble.textContent === cleanText && !target.domBubble.classList.contains("hidden")) {
          target.bubbleTimer = Math.max(target.bubbleTimer, opts.duration || 6.4);
          return;
        }
      }
      this._recentBubbles.set(dedupKey, now);
      if (this._recentBubbles.size > 100) {
        for (const [k, ts] of this._recentBubbles) {
          if (now - ts > 6000) this._recentBubbles.delete(k);
        }
      }

      const active = this._getActiveBubbleActors().filter((a) => a !== target);
      if (active.length >= 6) {
        active.sort((a, b) => a.bubbleTimer - b.bubbleTimer);
        const oldest = active[0];
        oldest.bubbleTimer = 0;
        oldest.domBubble.classList.add("hidden");
      }

      target.lastChatTs = now;
      target.domBubble.textContent = cleanText;
      target.domBubble.classList.remove("hidden", "fading");
      target.domBubble.style.animation = "none";
      void target.domBubble.offsetWidth;
      target.domBubble.style.animation = "";
      target.bubbleTimer = opts.duration || 6.4;
      return;
    }

    // Optional Demo Crowd Banter ONLY when explicitly enabled in Studio Settings
    if (!this.ambientBanterEnabled) return;
    const starterPool = opts.preferLawn && this.bgGuests.length > 0
      ? this.bgGuests
      : [...this.dancers.filter((d) => d.isStarter), ...this.bgGuests];
    const demoTarget = this._pickSpacedActor(starterPool);
    if (!demoTarget) return;

    const active = this._getActiveBubbleActors().filter((a) => a !== demoTarget);
    if (active.length >= 6) {
      active.sort((a, b) => a.bubbleTimer - b.bubbleTimer);
      active[0].bubbleTimer = 0;
      active[0].domBubble.classList.add("hidden");
    }

    demoTarget.domBubble.textContent = cleanText;
    demoTarget.domBubble.classList.remove("hidden", "fading");
    demoTarget.domBubble.style.animation = "none";
    void demoTarget.domBubble.offsetWidth;
    demoTarget.domBubble.style.animation = "";
    demoTarget.bubbleTimer = opts.duration || 5.8;
  }

  _tickAmbientBanter(dt) {
    if (!this.ambientBanterEnabled) return;
    const sinceRealChatMs = performance.now() - this._lastRealChatTs;
    if (this._lastRealChatTs > 0 && sinceRealChatMs < 4800) return;

    this._banterCooldown -= dt;
    if (this._banterCooldown > 0) return;

    const activeCount = this._getActiveBubbleActors().length;
    if (activeCount >= 5) {
      this._banterCooldown = 1.6;
      return;
    }

    const step = this._banterStep++;
    const useLawn = step % 3 === 0 && this.bgGuests.length > 0;
    const line = useLawn
      ? LAWN_BANTER_LINES[Math.floor(step / 3) % LAWN_BANTER_LINES.length]
      : RING_BANTER_LINES[step % RING_BANTER_LINES.length];

    this.showSpeechBubble(
      { uid: `banter_${step % 19}`, nickname: "Misafir" },
      line,
      { preferLawn: useLawn, duration: 5.8 + (step % 3) * 0.5 }
    );
    this._banterCooldown = activeCount < 3 ? 0.95 : 2.35;
  }

  triggerGiftEffect(user, tier, coins = 0, targetRoleChoice = null) {
    let target = this.dancerMap.get(user.uid);
    if (!target) {
      const added = this.joinHalay([user]);
      target = added[0];
    }
    if (!target) return;

    const addCoins = coins > 0 ? coins : (tier === "boss" ? 500 : (tier === "medium" ? 99 : 10));
    target.jumpTimer = tier === "boss" ? 2.6 : 1.45;
    target.spotTimer = tier === "boss" ? 7.5 : 4.8;
    target.rig.pinGoldCoin();
    target.coinsPinned = (target.coinsPinned || 0) + addCoins;
    const coinEl = target.domPlate?.querySelector(".plate-coin-tag");
    if (coinEl) {
      coinEl.textContent = `🪙 ${target.coinsPinned}`;
      coinEl.classList.remove("hidden");
    }

    // TikMax Signature Cinematic: Character steps out of circle, walks to bride/groom, pins gold/cash!
    const targetRole = targetRoleChoice || ((tier === "boss" || addCoins >= 100) ? (Math.random() > 0.5 ? "damat" : "gelin") : "gelin");
    const giftType = addCoins >= 100 ? "cash" : "gold";

    target.state = "walking_to_couple";
    target.giftTargetRole = targetRole;
    target.giftType = giftType;
    target.giftCoins = addCoins;
    target.pinnedDone = false;
    target.walkPhase = 0;
    target.rig.setHeldGift?.(giftType);
    target.homePos = target.rig.root.position.clone();
    target.destPos = new THREE.Vector3(targetRole === "gelin" ? -0.78 : 0.78, 0, -0.04);
    this.activeGifter = target;
    this.gifterFocusTimer = 6.2;

    if (tier === "boss" || addCoins >= 500) {
      target.rig.upgradeToHalaybasi();
      target.domPlate.className = "nameplate boss";
      if (!target.domPlate.querySelector(".boss-crown-float")) {
        const crownEl = document.createElement("div");
        crownEl.className = "boss-crown-float";
        crownEl.textContent = "👑";
        target.domPlate.prepend(crownEl);
      }
      const curIdx = this.dancers.indexOf(target);
      if (curIdx > 0) {
        this.dancers.splice(curIdx, 1);
        this.dancers.unshift(target);
      }
      this.squeezeFactor = 0.8;
      this.worldFX.spawnMoneyRain?.(110);
      this.worldFX.spawnCelebration(target.rig.root.position, 90, false);
    } else if (tier === "medium" || addCoins >= 150) {
      this.worldFX.spawnCelebration(target.rig.root.position, 85, false);
    } else {
      this.worldFX.spawnCelebration(target.rig.root.position, 32, false);
    }
  }

  triggerWelcomeWave(user) {
    let target = this.dancerMap.get(user?.uid);
    if (!target) {
      const added = this.joinHalay([user]);
      target = added[0];
    }
    if (!target) return;
    target.waveTimer = 1.25;
    this.activeWelcomeDancer = target;
    this.welcomeFocusTimer = 1.0;
  }

  getActiveDirectorFocus() {
    if (this.activeGifter && ["walking_to_couple", "pinning_gift", "returning_from_couple"].includes(this.activeGifter.state)) {
      return {
        type: "gifter",
        target: this.activeGifter,
        pos: this.activeGifter.rig.root.position,
      };
    }
    if (this.activeWelcomeDancer && this.welcomeFocusTimer > 0) {
      return {
        type: "welcome",
        target: this.activeWelcomeDancer,
        pos: this.activeWelcomeDancer.rig.root.position,
      };
    }
    const runner = this.getActiveRunnerFocus();
    if (runner) {
      return {
        type: "runner",
        pos: runner,
      };
    }
    return null;
  }

  getActiveRunnerFocus() {
    const runners = this.dancers.filter((d) => d.state === "running");
    if (runners.length === 0) return null;
    const sum = new THREE.Vector3();
    runners.forEach((r) => sum.add(r.rig.root.position));
    sum.divideScalar(runners.length);
    return sum;
  }

  _animateRoachMicroRig(rig, u, isTalking = false, energy = 1.0) {
    if (!rig || typeof rig.poseCharacter !== "function") return;
    rig.poseCharacter({ u, isTalking, energy });
  }

  update(dt, bpm, camera, stageW, stageH) {
    const gearMult = this.tempoGearMult || 1.0;
    const clampedBpm = Math.max(96, Math.min(156, bpm || 120));
    const beatsPerSec = (clampedBpm / 60.0) * gearMult;
    this.halayBeats = (this.halayBeats || 0) + dt * beatsPerSec;
    this.beatPhase = this.halayBeats * Math.PI;
    this.snakeBeat += dt * 1.45 * (clampedBpm / 118) * gearMult;

    // Step briskly during beats 0..2 of the 4-beat Halay bar, plant feet during beats 2..4 (yaylanma + topuk vurma)
    const barPosGlobal = ((this.halayBeats % 4) + 4) % 4;
    const stepGate = barPosGlobal < 2.0 ? Math.sin((barPosGlobal / 2.0) * Math.PI) : 0.08;
    const ringSpeed = (0.04 + stepGate * 0.30) * (clampedBpm / 120.0) * gearMult;
    this.ringAngle += dt * ringSpeed;
    this.squeezeFactor += (1.0 - this.squeezeFactor) * Math.min(1, dt * 0.45);
    if (this.wobbleTimer > 0) this.wobbleTimer = Math.max(0, this.wobbleTimer - dt);
    if (this.welcomeFocusTimer > 0) {
      this.welcomeFocusTimer = Math.max(0, this.welcomeFocusTimer - dt);
      if (this.welcomeFocusTimer <= 0) this.activeWelcomeDancer = null;
    }
    if (this.gifterFocusTimer > 0) this.gifterFocusTimer = Math.max(0, this.gifterFocusTimer - dt);

    if (!this._ikVecs) {
      this._ikVecs = {
        coupleHands: new THREE.Vector3(),
        coupleGaze: new THREE.Vector3(),
        mA: new THREE.Vector3(),
        mB: new THREE.Vector3(),
        mC: new THREE.Vector3(),
        mD: new THREE.Vector3(),
        pinWorld: new THREE.Vector3(),
        claspPool: Array.from({ length: 72 }, () => new THREE.Vector3()),
      };
    }
    const ikv = this._ikVecs;

    // 1. Centerpiece Bride & Groom Dignified Wedding Dance (Physically Holding Hands + Chest Sashes)
    if (this.coupleGroup.visible) {
      const waltz = this.halayBeats * Math.PI * 0.5;
      const sway = Math.sin(waltz);
      const dip = -Math.pow(Math.abs(Math.cos(waltz)), 1.6) * 0.032;
      this.coupleGroup.rotation.y = Math.sin(waltz * 0.5) * 0.12;
      this.brideRig.root.rotation.y = 0.26;
      this.groomRig.root.rotation.y = -0.26;
      this.coupleGroup.updateMatrixWorld(true);

      // Shared 3D hand-clasp point between Bride's Left Hand and Groom's Right Hand
      ikv.coupleHands.set(0, 1.15 + dip * 0.6 + Math.sin(waltz * 2) * 0.018, 0.16);
      this.coupleGroup.localToWorld(ikv.coupleHands);

      const gifterPinning = this.activeGifter && this.activeGifter.state === "pinning_gift" ? this.activeGifter : null;
      if (gifterPinning) {
        const gp = gifterPinning.rig.root.position;
        ikv.coupleGaze.set(gp.x, 1.48, gp.z);
      } else {
        ikv.coupleGaze.set(camera.position.x * 0.35, 1.75, 4.2);
      }
      const greetBow = gifterPinning ? 0.09 : 0.02;

      this.brideRig.poseCharacter({
        u: this.beatPhase,
        isTalking: this._announcerTimer > 0,
        energy: 0.85,
        hipSide: sway * 0.035,
        hipY: dip,
        spineLean: greetBow,
        spineSway: sway * 0.04,
        leftFoot: { side: Math.max(0, sway) * 0.04, lift: Math.max(0, sway) * 0.03, fwd: sway * 0.03 },
        rightFoot: { side: Math.min(0, sway) * 0.04, lift: Math.max(0, -sway) * 0.03, fwd: -sway * 0.03 },
        leftHandWorld: ikv.coupleHands,
        leftGrip: 0.68,
        rightHandLocal: { side: -0.20, up: 1.05 + dip * 0.4, fwd: 0.28 },
        rightGrip: 0.88,
        lookAtWorld: ikv.coupleGaze,
        lookWeight: 0.55,
      });

      this.groomRig.poseCharacter({
        u: this.beatPhase + 0.8,
        isTalking: false,
        energy: 0.85,
        hipSide: sway * 0.035,
        hipY: dip,
        spineLean: greetBow,
        spineSway: sway * 0.04,
        leftFoot: { side: Math.max(0, sway) * 0.04, lift: Math.max(0, sway) * 0.03, fwd: -sway * 0.03 },
        rightFoot: { side: Math.min(0, sway) * 0.04, lift: Math.max(0, -sway) * 0.03, fwd: sway * 0.03 },
        rightHandWorld: ikv.coupleHands,
        rightGrip: 0.68,
        leftHandLocal: gifterPinning
          ? { side: 0.04, up: 1.20, fwd: 0.22 }
          : { side: 0.25, up: 1.00, fwd: 0.14 },
        leftGrip: 0.58,
        lookAtWorld: ikv.coupleGaze,
        lookWeight: 0.55,
      });

      if (this.coupleDom) {
        [
          ["gelin", -0.44],
          ["damat", 0.44],
        ].forEach(([key, localX]) => {
          const slot = this.coupleDom[key];
          if (!slot || !slot.anchor) return;
          if (slot.bubbleTimer > 0) {
            slot.bubbleTimer -= dt;
            if (slot.bubbleTimer <= 0.38 && slot.bubbleTimer > 0) slot.bubble.classList.add("fading");
            if (slot.bubbleTimer <= 0) {
              slot.bubble.classList.remove("fading");
              slot.bubble.classList.add("hidden");
            }
          }
          this._projVec.set(localX, 2.22, -0.55);
          this._projVec.project(camera);
          if (this._projVec.z > 1.0) {
            slot.anchor.style.opacity = "0";
          } else {
            const sx = (this._projVec.x * 0.5 + 0.5) * stageW;
            const sy = (-this._projVec.y * 0.5 + 0.5) * stageH;
            slot.anchor.style.opacity = "1";
            slot.anchor.style.transform = `translate3d(${sx.toFixed(1)}px, ${sy.toFixed(1)}px, 0) translate(-50%, -100%)`;
            slot.anchor.style.zIndex = slot.bubbleTimer > 0 ? "258" : "24";
          }
        });
      }
    }

    // 2. Davulcu & Zurnacı Authentic Instrument IK Choreography
    for (let m = 0; m < this.musicians.length; m++) {
      const mus = this.musicians[m];
      const mBeats = this.halayBeats + (m === 0 ? 0 : 0.25);
      const u = mBeats * Math.PI;
      const groove = Math.sin(u * 0.5);
      const kneeDip = -Math.pow(Math.max(0, -Math.sin(u)), 1.5) * 0.055;
      mus.rig.root.rotation.y = mus.baseRy + Math.sin(u * 0.25) * 0.10;
      mus.rig.root.updateMatrixWorld(true);

      if (mus.role === "davulcu") {
        const nodes = mus.rig.root.userData?.davulNodes;
        const strikeWave = Math.pow(Math.max(0, Math.sin(u)), 2.2);
        const rimWave = Math.pow(Math.max(0, Math.sin(u * 2.0 + 0.8)), 2.0);
        let rWorld = null;
        let lWorld = null;
        if (nodes) {
          nodes.windupNode.getWorldPosition(ikv.mA);
          nodes.strikeNode.getWorldPosition(ikv.mB);
          rWorld = ikv.mA.lerp(ikv.mB, strikeWave);
          nodes.rimRestNode.getWorldPosition(ikv.mC);
          nodes.rimTapNode.getWorldPosition(ikv.mD);
          lWorld = ikv.mC.lerp(ikv.mD, rimWave);
        }
        const davul = mus.rig.root.userData?.davulGroup;
        if (davul) {
          const hitScale = 1.0 + (strikeWave > 0.72 ? (strikeWave - 0.72) * 0.16 : 0);
          davul.scale.set(hitScale, 1.0, hitScale);
        }
        mus.rig.poseCharacter({
          u,
          isTalking: mus.bubbleTimer > 0,
          energy: 1.15,
          hipSide: groove * 0.04,
          hipY: kneeDip,
          spineLean: 0.08 + strikeWave * 0.07,
          spineSway: groove * 0.05,
          leftFoot: { lift: Math.max(0, groove) * 0.06, fwd: Math.max(0, groove) * 0.06 },
          rightFoot: { lift: Math.max(0, -groove) * 0.06, fwd: Math.max(0, -groove) * 0.06 },
          rightHandWorld: rWorld,
          rightElbowUp: -0.18,
          rightElbowFwd: 0.15,
          rightGrip: 0.95,
          leftHandWorld: lWorld,
          leftElbowFwd: 0.18,
          leftGrip: 0.92,
        });
      } else {
        const zNodes = mus.rig.root.userData?.zurnaNodes;
        let lZurna = null;
        let rZurna = null;
        if (zNodes) {
          zNodes.leftGripNode.getWorldPosition(ikv.mA);
          zNodes.rightGripNode.getWorldPosition(ikv.mB);
          lZurna = ikv.mA;
          rZurna = ikv.mB;
        }
        mus.rig.poseCharacter({
          u,
          isTalking: false,
          energy: 1.1,
          hipSide: -groove * 0.04,
          hipY: kneeDip * 0.8,
          spineLean: -0.06 + Math.sin(u) * 0.04,
          spineSway: -groove * 0.06,
          spineTwist: Math.cos(u * 0.5) * 0.15,
          leftFoot: { lift: Math.max(0, -groove) * 0.05, side: 0.02 },
          rightFoot: { lift: Math.max(0, groove) * 0.05, side: -0.02 },
          leftHandWorld: lZurna,
          leftElbowFwd: 0.25,
          leftGrip: 0.84,
          rightHandWorld: rZurna,
          rightElbowUp: -0.25,
          rightElbowFwd: 0.25,
          rightGrip: 0.84,
        });
      }

      if (mus.domAnchor) {
        if (mus.bubbleTimer > 0) {
          mus.bubbleTimer -= dt;
          if (mus.bubbleTimer <= 0.38 && mus.bubbleTimer > 0) mus.domBubble.classList.add("fading");
          if (mus.bubbleTimer <= 0) {
            mus.domBubble.classList.remove("fading");
            mus.domBubble.classList.add("hidden");
          }
        }
        const mpos = mus.rig.root.position;
        this._projVec.set(mpos.x, 2.22, mpos.z);
        this._projVec.project(camera);
        if (this._projVec.z > 1.0) {
          mus.domAnchor.style.opacity = "0";
        } else {
          const sx = (this._projVec.x * 0.5 + 0.5) * stageW;
          const sy = (-this._projVec.y * 0.5 + 0.5) * stageH;
          mus.domAnchor.style.opacity = "1";
          mus.domAnchor.style.transform = `translate3d(${sx.toFixed(1)}px, ${sy.toFixed(1)}px, 0) translate(-50%, -100%)`;
          mus.domAnchor.style.zIndex = mus.bubbleTimer > 0 ? "255" : "18";
        }
      }
    }

    // 3. Optional Lawn Guests & Real Spectators
    this.bgGuests.forEach((g, i) => {
      const gu = this.beatPhase + i * 0.7;
      const gClap = 0.5 + 0.5 * Math.sin(gu * 2.0);
      g.rig.poseCharacter({
        u: gu,
        isTalking: g.bubbleTimer > 0,
        energy: 0.85,
        hipY: -Math.abs(Math.sin(gu * 0.5)) * 0.04,
        spineSway: Math.sin(gu * 0.5) * 0.05,
        leftHandLocal: { side: 0.06 + gClap * 0.12, up: 1.16, fwd: 0.28 },
        rightHandLocal: { side: -0.06 - gClap * 0.12, up: 1.16, fwd: 0.28 },
      });

      if (g.bubbleTimer > 0) {
        g.bubbleTimer -= dt;
        if (g.bubbleTimer <= 0.38 && g.bubbleTimer > 0) g.domBubble.classList.add("fading");
        if (g.bubbleTimer <= 0) g.domBubble.classList.remove("fading"), g.domBubble.classList.add("hidden");
      }

      const gpos = g.rig.root.position;
      this._projVec.set(gpos.x, 2.34, gpos.z);
      this._projVec.project(camera);
      if (this._projVec.z > 1.0) {
        g.domAnchor.style.opacity = "0";
      } else {
        const sx = (this._projVec.x * 0.5 + 0.5) * stageW;
        const sy = (-this._projVec.y * 0.5 + 0.5) * stageH;
        g.screenX = sx;
        g.screenY = sy;
        if (g.bubbleTimer > 0) {
          const pad = 92;
          const shift = sx < pad ? pad - sx : (sx > stageW - pad ? (stageW - pad) - sx : 0);
          g.domBubble.style.setProperty("--bx", `${shift.toFixed(1)}px`);
        }
        g.domAnchor.style.opacity = "1";
        g.domAnchor.style.transform = `translate3d(${sx.toFixed(1)}px, ${sy.toFixed(1)}px, 0) translate(-50%, -100%)`;
        g.domAnchor.style.zIndex = g.bubbleTimer > 0 ? String(220 + Math.round(g.bubbleTimer * 10)) : "4";
      }
    });

    this._tickAmbientBanter(dt);

    for (let s = 0; s < this.spectators.length; s++) {
      const sp = this.spectators[s];
      const spSlot = this._computeSpectatorSlot(s, this.spectators.length);
      const spos = sp.rig.root.position;
      spos.x += (spSlot.x - spos.x) * Math.min(1, dt * 5.2);
      spos.z += (spSlot.z - spos.z) * Math.min(1, dt * 5.2);
      sp.rig.root.rotation.y = Math.atan2(0 - spos.x, -0.55 - spos.z);

      let spJump = 0;
      if (sp.jumpTimer > 0) {
        sp.jumpTimer -= dt;
        spJump = Math.abs(Math.sin(sp.jumpTimer * 7)) * 0.38;
      }
      const su = this.beatPhase + s * 0.8;
      const clap = 0.5 + 0.5 * Math.sin(su * 2.0);
      sp.rig.poseCharacter({
        u: su,
        isTalking: sp.bubbleTimer > 0,
        energy: 0.95,
        jumpY: spJump,
        hipY: -Math.abs(Math.cos(su)) * 0.04,
        spineSway: Math.sin(su * 0.5) * 0.05,
        leftHandLocal: { side: 0.05 + clap * 0.14, up: 1.18, fwd: 0.28 },
        rightHandLocal: { side: -0.05 - clap * 0.14, up: 1.18, fwd: 0.28 },
      });

      if (sp.bubbleTimer > 0) {
        sp.bubbleTimer -= dt;
        if (sp.bubbleTimer <= 0.38 && sp.bubbleTimer > 0) sp.domBubble.classList.add("fading");
        if (sp.bubbleTimer <= 0) {
          sp.domBubble.classList.remove("fading");
          sp.domBubble.classList.add("hidden");
        }
      }

      this._projVec.set(spos.x, 2.28 + spJump, spos.z);
      this._projVec.project(camera);
      if (this._projVec.z > 1.0) {
        sp.domAnchor.style.opacity = "0";
      } else {
        const sx = (this._projVec.x * 0.5 + 0.5) * stageW;
        const sy = (-this._projVec.y * 0.5 + 0.5) * stageH;
        sp.screenX = sx;
        sp.screenY = sy;
        if (sp.bubbleTimer > 0) {
          const pad = 92;
          const shift = sx < pad ? pad - sx : (sx > stageW - pad ? (stageW - pad) - sx : 0);
          sp.domBubble.style.setProperty("--bx", `${shift.toFixed(1)}px`);
        }
        sp.domAnchor.style.opacity = "1";
        sp.domAnchor.style.transform = `translate3d(${sx.toFixed(1)}px, ${sy.toFixed(1)}px, 0) translate(-50%, -100%)`;
        sp.domAnchor.style.zIndex = sp.bubbleTimer > 0 ? String(245 + Math.round(sp.bubbleTimer * 10)) : "10";
      }
    }

    let spotUsed = 0;
    this.spotPool.forEach((s) => { s.visible = false; });

    const coupleLookTarget = ikv.mD.set(0, 1.38, -0.55);

    // 4A. Pass 1 — Update All Dancer Positions, Orientations & State Transitions First
    for (let i = 0; i < this.dancers.length; i++) {
      const d = this.dancers[i];
      const slot = this._computeFormationSlot(i, d.team);
      d._slot = slot;
      const pos = d.rig.root.position;

      if (d.state === "running") {
        const dx = slot.x - pos.x;
        const dz = slot.z - pos.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 0.36) {
          d.state = "dancing";
        } else {
          const move = Math.min(dist, 4.2 * dt);
          pos.x += (dx / dist) * move;
          pos.z += (dz / dist) * move;
          d.walkPhase = (d.walkPhase || 0) + move * 3.1;
          d.rig.root.rotation.y = Math.atan2(dx, dz);
        }
      } else if (d.state === "walking_to_couple") {
        const isBride = (d.giftTargetRole || "gelin") === "gelin";
        const dest = d.destPos || new THREE.Vector3(isBride ? -0.78 : 0.78, 0, -0.04);
        const dx = dest.x - pos.x;
        const dz = dest.z - pos.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 0.16) {
          pos.x = dest.x;
          pos.z = dest.z;
          d.state = "pinning_gift";
          d.pinDuration = 1.85;
          d.pinTimer = 1.85;
          d.pinnedDone = false;
        } else {
          const move = Math.min(dist, 2.85 * dt);
          pos.x += (dx / dist) * move;
          pos.z += (dz / dist) * move;
          d.walkPhase = (d.walkPhase || 0) + move * 3.2;
          d.rig.root.rotation.y = Math.atan2(dx, dz);
        }
      } else if (d.state === "returning_from_couple") {
        const dx = slot.x - pos.x;
        const dz = slot.z - pos.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 0.34) {
          d.state = "dancing";
          d.rig.setHeldGift?.(null);
          if (this.activeGifter === d) this.activeGifter = null;
        } else {
          const move = Math.min(dist, 3.25 * dt);
          pos.x += (dx / dist) * move;
          pos.z += (dz / dist) * move;
          d.walkPhase = (d.walkPhase || 0) + move * 3.2;
          d.rig.root.rotation.y = Math.atan2(dx, dz);
        }
      }

      if (d.state === "dancing") {
        d.rig.setHeldGift?.(null);
        pos.x += (slot.x - pos.x) * Math.min(1, dt * 5.2);
        pos.z += (slot.z - pos.z) * Math.min(1, dt * 5.2);
        // Always face inward toward Bride & Groom at (0, 0, -0.55) — never stare back at camera
        const toCoupleAngle = Math.atan2(0 - pos.x, -0.55 - pos.z);
        const subtleTurn = Math.sin(this.halayBeats * Math.PI * 0.5) * 0.045;
        d.rig.root.rotation.y = toCoupleAngle + subtleTurn;
      }
    }

    // 4B. Pre-compute Exact Shared 3D Hand-Clasp Midpoints Between Adjacent Dancing Neighbors
    const isHoronMode = this.sceneMode === "horon";
    const isZeybekMode = this.sceneMode === "zeybek";
    const barIdx = Math.floor(this.halayBeats / 4);
    const barPos = ((this.halayBeats % 4) + 4) % 4;
    // Periodic "Tey! Tey!" overhead arm lift on every 4th 4-beat bar
    const teyLift = (!isHoronMode && !isZeybekMode && (barIdx % 4 === 3))
      ? Math.pow(Math.sin((barPos / 4.0) * Math.PI), 1.4)
      : 0;
    const armPump = Math.sin(this.halayBeats * Math.PI * (isHoronMode ? 2.0 : 1.0)) * (isHoronMode ? 0.06 : 0.045);
    // Shoulder/upper-chest linked Halay arm posture matching reference Anatolian Halay ("omuz / kol halayı")
    const baseClaspY = isHoronMode
      ? 1.44 + armPump
      : (1.28 + teyLift * 0.30 + armPump);

    for (let i = 0; i < this.dancers.length; i++) {
      const dA = this.dancers[i];
      dA._claspLeft = null;
      dA._claspRight = null;
    }
    if (!isZeybekMode) {
      for (let i = 0; i < this.dancers.length; i++) {
        const dA = this.dancers[i];
        if (dA.state !== "dancing") continue;
        const sA = dA._slot;
        let nextIdx = -1;
        if (i + 1 < this.dancers.length && this.dancers[i + 1]._slot?.ringIdx === sA.ringIdx) {
          nextIdx = i + 1;
        } else if (sA.isClosedRing && sA.inThisRing >= 3) {
          const ringStart = i - sA.rem;
          if (ringStart >= 0 && ringStart < this.dancers.length) nextIdx = ringStart;
        }
        if (nextIdx < 0) continue;
        const dB = this.dancers[nextIdx];
        if (dB.state !== "dancing") continue;
        // Do not tie Halaybaşı's right (mendil) hand or an active waving right hand
        if (dB.rig.isHalaybasi() || dB.waveTimer > 0) continue;

        const pA = dA.rig.root.position;
        const pB = dB.rig.root.position;
        const distAB = Math.hypot(pB.x - pA.x, pB.z - pA.z);
        if (distAB > 1.72) continue;

        const mx = (pA.x + pB.x) * 0.5;
        const mz = (pA.z + pB.z) * 0.5;
        const toCx = 0 - mx;
        const toCz = -0.55 - mz;
        const toCLen = Math.hypot(toCx, toCz) || 1;
        const fwdPush = 0.14 + teyLift * 0.08 + Math.sin(this.halayBeats * Math.PI) * 0.03;

        const cVec = ikv.claspPool[i % ikv.claspPool.length];
        cVec.set(
          mx + (toCx / toCLen) * fwdPush,
          baseClaspY,
          mz + (toCz / toCLen) * fwdPush
        );
        dA._claspLeft = cVec;
        dB._claspRight = cVec;
      }
    }

    // 4C. Pass 2 — Pose Every Dancer via Ground-Up Skeletal Choreography & Two-Bone IK
    for (let i = 0; i < this.dancers.length; i++) {
      const d = this.dancers[i];
      const pos = d.rig.root.position;
      let jumpOffset = 0;
      if (d.jumpTimer > 0) {
        d.jumpTimer -= dt;
        jumpOffset = Math.abs(Math.sin(d.jumpTimer * 6.5)) * 0.34;
      }

      if (d.state === "walking_to_couple" || d.state === "returning_from_couple" || d.state === "running") {
        const wp = d.walkPhase || 0;
        const s = Math.sin(wp);
        const c = Math.cos(wp);
        const carryingGift = d.state === "walking_to_couple";
        d.rig.poseCharacter({
          u: wp * 1.4,
          isTalking: d.bubbleTimer > 0,
          energy: 1.15,
          jumpY: jumpOffset,
          hipY: -0.024 + Math.abs(s) * 0.030,
          spineLean: 0.06,
          spineTwist: s * 0.09,
          leftFoot: { fwd: s * 0.24, lift: Math.max(0, c) * 0.11, pitch: -s * 0.16 },
          rightFoot: { fwd: -s * 0.24, lift: Math.max(0, -c) * 0.11, pitch: s * 0.16 },
          leftHandLocal: { side: 0.28, up: 0.96, fwd: 0.06 - s * 0.18 },
          leftGrip: 0.45,
          rightHandLocal: carryingGift
            ? { side: -0.18, up: 1.22 + Math.abs(s) * 0.03, fwd: 0.32 }
            : { side: -0.28, up: 0.96, fwd: 0.06 + s * 0.18 },
          rightGrip: carryingGift ? 0.88 : 0.45,
        });
      } else if (d.state === "pinning_gift") {
        d.pinTimer -= dt;
        const isBride = (d.giftTargetRole || "gelin") === "gelin";
        const targetX = isBride ? -0.44 : 0.44;
        d.rig.root.rotation.y = Math.atan2(targetX - pos.x, -0.55 - pos.z);

        const totalPin = d.pinDuration || 1.85;
        const prog = THREE.MathUtils.clamp(1.0 - (d.pinTimer / totalPin), 0, 1);
        const targetSash = isBride ? this.brideSash : this.groomSash;
        if (targetSash?.pinAnchor) {
          targetSash.pinAnchor.getWorldPosition(ikv.pinWorld);
        } else {
          ikv.pinWorld.set(targetX, 1.32, -0.35);
        }

        if (prog >= 0.48 && !d.pinnedDone) {
          d.pinnedDone = true;
          d.rig.setHeldGift?.(null);
          this.pinBrideGroomGold(d.giftType || "gold", 1, d.giftTargetRole || "gelin");
          if (this.onGiftPinned) {
            this.onGiftPinned({
              dancer: d,
              role: d.giftTargetRole || "gelin",
              type: d.giftType || "gold",
              coins: d.giftCoins || 10,
            });
          }
        }

        const reachingSash = prog < 0.62;
        const bowAmt = reachingSash
          ? 0.12 * Math.sin((prog / 0.62) * Math.PI * 0.85)
          : 0.18 * Math.sin(((prog - 0.62) / 0.38) * Math.PI);

        ikv.mC.set(targetX, 1.48, -0.55);
        d.rig.poseCharacter({
          u: this.beatPhase,
          isTalking: d.bubbleTimer > 0,
          energy: 1.0,
          hipY: -0.02,
          spineLean: bowAmt,
          leftFoot: { fwd: 0.04 },
          rightFoot: { fwd: -0.04 },
          leftHandLocal: { side: 0.26, up: 0.98, fwd: 0.12 },
          leftGrip: 0.55,
          rightHandWorld: reachingSash ? ikv.pinWorld : null,
          rightHandLocal: reachingSash ? null : { side: -0.04, up: 1.22, fwd: 0.22 },
          rightElbowUp: -0.28,
          rightElbowFwd: 0.12,
          rightGrip: reachingSash ? 0.88 : 0.65,
          lookAtWorld: ikv.mC,
          lookWeight: 0.75,
        });

        if (d.pinTimer <= 0) {
          d.state = "returning_from_couple";
        }
      } else if (d.state === "dancing") {
        if (d.zeybekTimer > 0) d.zeybekTimer -= dt;
        const isZeybek = isZeybekMode || d.zeybekTimer > 0;
        const u = this.beatPhase - i * 0.03;

        let lf = { side: 0, lift: 0, fwd: 0, pitch: 0 };
        let rf = { side: 0, lift: 0, fwd: 0, pitch: 0 };
        let hipSide = 0;
        let hipY = 0;
        let spineLean = 0.03;
        let spineSway = 0;

        if (isZeybek) {
          const zCycle = ((this.halayBeats * 0.5 + i * 0.25) % 4 + 4) % 4;
          const kneel = zCycle >= 2.0 ? Math.pow(Math.sin(((zCycle - 2.0) / 2.0) * Math.PI), 1.8) : 0;
          hipY = -kneel * 0.22;
          spineLean = kneel * 0.18 - 0.04;
          spineSway = Math.sin(u * 0.5) * 0.07;
          rf = { fwd: kneel * 0.22, lift: zCycle < 1.0 ? Math.sin(zCycle * Math.PI) * 0.14 : 0, side: -0.04 };
          lf = { fwd: -kneel * 0.12, lift: (zCycle >= 1.0 && zCycle < 2.0) ? Math.sin((zCycle - 1.0) * Math.PI) * 0.12 : 0, side: 0.04 };
        } else if (isHoronMode) {
          const hStep = Math.sin(this.halayBeats * Math.PI * 2.0);
          const tremor = Math.sin(this.halayBeats * Math.PI * 6.0) * 0.018;
          hipY = -0.045 + Math.abs(hStep) * 0.04 + tremor;
          spineSway = tremor * 2.2;
          rf = { lift: Math.max(0, hStep) * 0.13, fwd: Math.max(0, hStep) * 0.12, side: -0.03 };
          lf = { lift: Math.max(0, -hStep) * 0.13, fwd: Math.max(0, -hStep) * 0.12, side: 0.03 };
        } else {
          // Authentic 4-Beat C1-Continuous Anatolian Halay Footwork:
          // Beat 0..1: Step Right | Beat 1..2: Close Left | Beat 2..3: Double Yaylanma | Beat 3..4: Forward Topuk Vurma!
          const sm = (x) => x * x * (3 - 2 * x);
          if (barPos < 1.0) {
            const p = barPos;
            const e = sm(p);
            const arc = Math.sin(p * Math.PI);
            rf = { side: -0.13 * e, lift: 0.12 * arc, fwd: 0, pitch: 0 };
            lf = { side: 0.05 * e, lift: 0, fwd: 0, pitch: 0 };
            hipSide = -0.04 * e;
            hipY = -0.035 * arc;
            spineSway = -0.035 * arc;
          } else if (barPos < 2.0) {
            const p = barPos - 1.0;
            const e = sm(p);
            const arc = Math.sin(p * Math.PI);
            rf = { side: -0.13 * (1 - e) - 0.03 * e, lift: 0, fwd: 0, pitch: 0 };
            lf = { side: 0.05 * (1 - e) - 0.05 * e, lift: 0.11 * arc, fwd: 0, pitch: 0 };
            hipSide = -0.04 * (1 - e);
            hipY = -0.035 * arc;
            spineSway = 0.03 * arc;
          } else if (barPos < 3.0) {
            const p = barPos - 2.0;
            const e = sm(p);
            const doubleBounce = Math.pow(Math.sin(p * Math.PI * 2.0), 2);
            rf = { side: -0.03 * (1 - e), lift: 0, fwd: 0, pitch: 0 };
            lf = { side: -0.05 * (1 - e), lift: 0, fwd: 0, pitch: 0 };
            hipY = -0.078 * doubleBounce;
            spineLean = 0.04 + 0.04 * doubleBounce;
          } else {
            const p = barPos - 3.0;
            const kick = Math.sin(p * Math.PI);
            const tapLift = p < 0.5
              ? Math.sin(p * 2.0 * Math.PI) * 0.085
              : Math.sin((p - 0.5) * 2.0 * Math.PI) * 0.065;
            rf = {
              side: -0.02 * kick,
              lift: Math.max(0, tapLift),
              fwd: kick * (0.27 + teyLift * 0.07),
              pitch: -kick * 0.42,
            };
            lf = { side: 0, lift: 0, fwd: 0, pitch: 0 };
            hipY = -0.045 * Math.pow(Math.cos((p - 0.5) * Math.PI), 2);
            spineLean = -0.07 * kick + 0.03;
          }
        }

        if (this.wobbleTimer > 0) {
          const wFrac = this.wobbleTimer / 2.4;
          spineSway += Math.sin(this.wobbleTimer * 20.0 + (d.wobblePhase || 0)) * 0.22 * wFrac;
        }

        let lHandWorld = d._claspLeft;
        let rHandWorld = d._claspRight;
        let lHandLocal = null;
        let rHandLocal = null;
        let rElbowUp = -0.52;
        let lGrip = 0.72;
        let rGrip = 0.72;
        let mendilSpd = 1.0;

        if (isZeybek) {
          lHandWorld = null;
          rHandWorld = null;
          const wing = Math.sin(u * 0.5) * 0.08;
          lHandLocal = { side: 0.56, up: 1.48 + wing, fwd: 0.16 };
          rHandLocal = { side: -0.56, up: 1.48 - wing, fwd: 0.16 };
          rElbowUp = -0.20;
          lGrip = 0.35;
          rGrip = 0.35;
        } else {
          if (!lHandWorld) {
            lHandLocal = { side: 0.28, up: 1.00 + teyLift * 0.46 + armPump, fwd: 0.12 };
            lGrip = 0.62;
          }
          if (d.waveTimer > 0) {
            d.waveTimer -= dt;
            rHandWorld = null;
            rHandLocal = {
              side: -0.36 + Math.sin(this.beatPhase * 4.5) * 0.14,
              up: 1.64,
              fwd: 0.24,
            };
            rElbowUp = -0.18;
            rGrip = 0.18;
          } else if (d.rig.isHalaybasi()) {
            rHandWorld = null;
            const whip = this.halayBeats * Math.PI;
            rHandLocal = {
              side: -0.40 + Math.sin(whip) * 0.10,
              up: 1.66 + Math.sin(whip * 2.0) * 0.07 + teyLift * 0.08,
              fwd: 0.22 + Math.cos(whip) * 0.11,
            };
            rElbowUp = -0.16;
            rGrip = 0.92;
            mendilSpd = 1.35 + teyLift * 0.45;
          } else if (!rHandWorld) {
            rHandLocal = { side: -0.28, up: 1.00 + teyLift * 0.46 + armPump, fwd: 0.12 };
            rGrip = 0.62;
          }
        }

        d.rig.poseCharacter({
          u: u + i * 0.2,
          isTalking: d.bubbleTimer > 0,
          energy: isHoronMode ? 1.35 : 1.05,
          jumpY: jumpOffset,
          hipSide,
          hipY,
          spineLean,
          spineSway,
          leftFoot: lf,
          rightFoot: rf,
          leftHandWorld: lHandWorld,
          leftHandLocal: lHandLocal,
          leftGrip: lGrip,
          rightHandWorld: rHandWorld,
          rightHandLocal: rHandLocal,
          rightElbowUp: rElbowUp,
          rightGrip: rGrip,
          lookAtWorld: coupleLookTarget,
          lookWeight: 0.62,
          mendilSpeed: mendilSpd,
        });
      }

      if (d.spotTimer > 0) {
        d.spotTimer -= dt;
        if (spotUsed < this.spotPool.length) {
          const sp = this.spotPool[spotUsed++];
          sp.position.set(pos.x, 3.7, pos.z);
          sp.visible = true;
        }
      }

      if (d.bubbleTimer > 0) {
        d.bubbleTimer -= dt;
        if (d.bubbleTimer <= 0.38 && d.bubbleTimer > 0) d.domBubble.classList.add("fading");
        if (d.bubbleTimer <= 0) {
          d.domBubble.classList.remove("fading");
          d.domBubble.classList.add("hidden");
        }
      }

      const headHeight = (d.rig.isHalaybasi() ? 2.24 : 2.08) + jumpOffset;
      this._projVec.set(pos.x, headHeight, pos.z);
      this._projVec.project(camera);

      if (this._projVec.z > 1.0) {
        d.domAnchor.style.opacity = "0";
      } else {
        const sx = (this._projVec.x * 0.5 + 0.5) * stageW;
        const sy = (-this._projVec.y * 0.5 + 0.5) * stageH;
        d.screenX = sx;
        d.screenY = sy;
        if (d.bubbleTimer > 0) {
          const pad = 92;
          const shift = sx < pad ? pad - sx : (sx > stageW - pad ? (stageW - pad) - sx : 0);
          d.domBubble.style.setProperty("--bx", `${shift.toFixed(1)}px`);
        }
        d.domAnchor.style.opacity = "1";
        d.domAnchor.style.transform = `translate3d(${sx.toFixed(1)}px, ${sy.toFixed(1)}px, 0) translate(-50%, -100%)`;
        d.domAnchor.style.zIndex = d.bubbleTimer > 0
          ? String(240 + Math.round(d.bubbleTimer * 10))
          : String(Math.max(5, Math.floor((1 - this._projVec.z) * 28)));
      }
    }
  }
}
