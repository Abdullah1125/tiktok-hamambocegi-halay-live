import * as THREE from "three";

function createSkyTexture() {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 512;
  const g = c.getContext("2d");
  const grad = g.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0.0, "#05060b");
  grad.addColorStop(0.38, "#090b14");
  grad.addColorStop(0.72, "#131424");
  grad.addColorStop(1.0, "#1c1b2e");
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 512);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createMeadowGrassTexture() {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 512;
  const g = c.getContext("2d");
  g.fillStyle = "#1b291a";
  g.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 4800; i++) {
    const x = ((Math.sin(i * 12.9898) * 43758.5453) % 1 + 1) % 1 * 512;
    const y = ((Math.sin(i * 78.233) * 29432.1234) % 1 + 1) % 1 * 512;
    const tone = i % 3 === 0 ? "#243822" : (i % 3 === 1 ? "#162315" : "#2d4429");
    g.fillStyle = tone;
    g.fillRect(x, y, 2.4, 6.0);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(18, 18);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createHexCobbleTextures() {
  // 11692FonWDI ("Bocek Dugun Sahnesi") 1:1 Dark Slate-Purple Hexagonal Cobblestone Floor!
  const colorCanvas = document.createElement("canvas");
  colorCanvas.width = 1024;
  colorCanvas.height = 1024;
  const ctx = colorCanvas.getContext("2d");

  const bumpCanvas = document.createElement("canvas");
  bumpCanvas.width = 1024;
  bumpCanvas.height = 1024;
  const bctx = bumpCanvas.getContext("2d");

  ctx.fillStyle = "#2b2736";
  ctx.fillRect(0, 0, 1024, 1024);
  bctx.fillStyle = "#181818";
  bctx.fillRect(0, 0, 1024, 1024);

  const r = 36;
  const dx = r * 1.5;
  const dy = r * Math.sqrt(3);

  const drawRoundedHex = (g2d, cx, cy, rad) => {
    const pts = [];
    for (let i = 0; i < 6; i++) {
      const ang = (Math.PI / 3) * i;
      pts.push([cx + rad * Math.cos(ang), cy + rad * Math.sin(ang)]);
    }
    g2d.beginPath();
    for (let i = 0; i < 6; i++) {
      const p0 = pts[(i + 5) % 6];
      const p1 = pts[i];
      const p2 = pts[(i + 1) % 6];
      const ax = p1[0] + (p0[0] - p1[0]) * 0.18;
      const ay = p1[1] + (p0[1] - p1[1]) * 0.18;
      const bx = p1[0] + (p2[0] - p1[0]) * 0.18;
      const by = p1[1] + (p2[1] - p1[1]) * 0.18;
      if (i === 0) g2d.moveTo(ax, ay);
      else g2d.lineTo(ax, ay);
      g2d.quadraticCurveTo(p1[0], p1[1], bx, by);
    }
    g2d.closePath();
  };

  for (let col = -1; col < 24; col++) {
    for (let row = -1; row < 20; row++) {
      const cx = col * dx;
      const cy = row * dy + (col % 2 !== 0 ? dy / 2 : 0);

      const base = 74 + Math.floor((Math.sin(col * 12.7 + row * 7.3) * 0.5 + 0.5) * 18);
      const purp = 12 + Math.floor((Math.cos(col * 5.1 - row * 9.2) * 0.5 + 0.5) * 8);
      const grad = ctx.createRadialGradient(cx - 4, cy - 4, 3, cx, cy, r);
      grad.addColorStop(0, `rgb(${base + 6}, ${base + 2}, ${base + purp + 8})`);
      grad.addColorStop(0.82, `rgb(${base - 6}, ${base - 9}, ${base + purp - 4})`);
      grad.addColorStop(1, "#2a2634");

      drawRoundedHex(ctx, cx, cy, r - 2.6);
      ctx.fillStyle = grad;
      ctx.fill();

      const bGrad = bctx.createRadialGradient(cx - 3, cy - 3, 4, cx, cy, r);
      bGrad.addColorStop(0, "#f0f0f0");
      bGrad.addColorStop(0.82, "#b8b8b8");
      bGrad.addColorStop(1, "#222222");
      drawRoundedHex(bctx, cx, cy, r - 2.6);
      bctx.fillStyle = bGrad;
      bctx.fill();
    }
  }

  const colorTex = new THREE.CanvasTexture(colorCanvas);
  colorTex.wrapS = THREE.RepeatWrapping;
  colorTex.wrapT = THREE.RepeatWrapping;
  colorTex.repeat.set(7.5, 7.5);
  colorTex.colorSpace = THREE.SRGBColorSpace;
  colorTex.anisotropy = 8;

  const bumpTex = new THREE.CanvasTexture(bumpCanvas);
  bumpTex.wrapS = THREE.RepeatWrapping;
  bumpTex.wrapT = THREE.RepeatWrapping;
  bumpTex.repeat.set(7.5, 7.5);

  return { colorTex, bumpTex };
}

function createDollarBillTexture() {
  // 11692FonWDI ("Bocek Dugun Sahnesi") 1:1 Green Dollar Bill Texture for "PARA SAÇ" (500 Coins)
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 128;
  const g = c.getContext("2d");

  g.fillStyle = "#16a34a";
  g.fillRect(0, 0, 256, 128);

  g.strokeStyle = "#dcfce7";
  g.lineWidth = 8;
  g.strokeRect(10, 10, 236, 108);

  g.strokeStyle = "#14532d";
  g.lineWidth = 3;
  g.strokeRect(20, 20, 216, 88);

  g.fillStyle = "#bbf7d0";
  g.beginPath();
  g.ellipse(128, 64, 34, 28, 0, 0, Math.PI * 2);
  g.fill();

  g.fillStyle = "#14532d";
  g.font = "900 42px Arial, sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText("$", 128, 66);

  g.fillStyle = "#dcfce7";
  g.font = "800 22px Arial, sans-serif";
  g.fillText("100", 48, 42);
  g.fillText("100", 208, 88);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createSoftGlowSpriteTexture() {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 64;
  const g = c.getContext("2d");
  const rad = g.createRadialGradient(32, 32, 2, 32, 32, 30);
  rad.addColorStop(0, "rgba(255, 255, 250, 1)");
  rad.addColorStop(0.32, "rgba(255, 248, 210, 0.95)");
  rad.addColorStop(0.65, "rgba(253, 224, 130, 0.40)");
  rad.addColorStop(1, "rgba(253, 224, 130, 0)");
  g.fillStyle = rad;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

export function buildWeddingWorld(scene) {
  scene.background = new THREE.Color(0x090a12);
  scene.fog = new THREE.FogExp2(0x0d0e18, 0.012);

  const skyDome = new THREE.Mesh(
    new THREE.SphereGeometry(95, 32, 20),
    new THREE.MeshBasicMaterial({ map: createSkyTexture(), side: THREE.BackSide, fog: false })
  );
  scene.add(skyDome);

  const hemi = new THREE.HemisphereLight(0xfff5e6, 0x38344c, 1.55);
  scene.add(hemi);

  const dirLight = new THREE.DirectionalLight(0xffeed8, 1.52);
  dirLight.position.set(6, 24, 18);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.set(512, 512); // Optimized for 60 FPS in TikTok LIVE Studio CEF
  dirLight.shadow.camera.near = 2;
  dirLight.shadow.camera.far = 80;
  const d = 22;
  dirLight.shadow.camera.left = -d;
  dirLight.shadow.camera.right = d;
  dirLight.shadow.camera.top = d;
  dirLight.shadow.camera.bottom = -d;
  dirLight.shadow.bias = -0.0004;
  scene.add(dirLight);

  // Warm center stage light illuminating Bride, Groom & Halay Ring
  const stageWarmLight = new THREE.PointLight(0xffdfba, 1.35, 32, 1.2);
  stageWarmLight.position.set(0, 6.5, 1.5);
  scene.add(stageWarmLight);

  // 1. GROUND / FLOOR: Dark Night Lawn + 3D Grass Tufts + Dark Slate-Purple Hexagonal Cobblestone Plaza
  const lawn = new THREE.Mesh(
    new THREE.PlaneGeometry(180, 180),
    new THREE.MeshStandardMaterial({ map: createMeadowGrassTexture(), roughness: 0.94 })
  );
  lawn.rotation.x = -Math.PI / 2;
  lawn.position.y = -0.04;
  lawn.receiveShadow = true;
  scene.add(lawn);

  const { colorTex, bumpTex } = createHexCobbleTextures();
  const plaza = new THREE.Mesh(
    new THREE.CircleGeometry(15.5, 96),
    new THREE.MeshStandardMaterial({
      map: colorTex,
      bumpMap: bumpTex,
      bumpScale: 0.05,
      roughness: 0.76,
      metalness: 0.04,
    })
  );
  plaza.rotation.x = -Math.PI / 2;
  plaza.position.set(0, 0, 0.5);
  plaza.receiveShadow = true;
  scene.add(plaza);

  // 3D Grass Blade Clusters around the courtyard perimeter
  const grassMat = new THREE.MeshStandardMaterial({ color: 0x284624, roughness: 0.85 });
  const bladeGeo = new THREE.ConeGeometry(0.08, 0.48, 5);
  for (let gi = 0; gi < 48; gi++) {
    const ang = (gi / 48) * Math.PI * 1.4 - Math.PI * 1.2;
    const gr = 14.2 + (gi % 4) * 1.3;
    const gx = Math.cos(ang) * gr;
    const gz = Math.sin(ang) * gr - 1.0;
    const tuft = new THREE.Group();
    for (let b = 0; b < 4; b++) {
      const blade = new THREE.Mesh(bladeGeo, grassMat);
      blade.position.set((b - 1.5) * 0.09, 0.22, (b % 2) * 0.07);
      blade.rotation.z = (b - 1.5) * 0.18;
      tuft.add(blade);
    }
    tuft.position.set(gx, 0, gz);
    scene.add(tuft);
  }

  // 2. 11692FonWDI 1:1 CENTER RED CIRCULAR STAGE ("KIRMIZI PİST") + NEON GOLD-WHITE RIM + 3D BALLOON ARCH!
  const centerStageGroup = new THREE.Group();
  centerStageGroup.position.set(0, 0, -0.55);

  // Red circular velvet platform
  const redCarpetDisk = new THREE.Mesh(
    new THREE.CylinderGeometry(2.08, 2.14, 0.11, 64),
    new THREE.MeshStandardMaterial({
      color: 0xa80c18,
      emissive: 0x45050a,
      emissiveIntensity: 0.35,
      roughness: 0.55,
    })
  );
  redCarpetDisk.position.y = 0.055;
  redCarpetDisk.receiveShadow = true;
  centerStageGroup.add(redCarpetDisk);

  // Bright glowing golden-white neon rim torus around the red stage
  const neonRim = new THREE.Mesh(
    new THREE.TorusGeometry(2.11, 0.055, 16, 72),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffe49e,
      emissiveIntensity: 2.2,
      roughness: 0.2,
    })
  );
  neonRim.rotation.x = Math.PI / 2;
  neonRim.position.y = 0.065;
  centerStageGroup.add(neonRim);

  // Soft warm radial halo under the neon rim
  const spotCanvas = document.createElement("canvas");
  spotCanvas.width = 256;
  spotCanvas.height = 256;
  const sctx = spotCanvas.getContext("2d");
  const sgrad = sctx.createRadialGradient(128, 128, 52, 128, 128, 126);
  sgrad.addColorStop(0.0, "rgba(255, 225, 140, 0.0)");
  sgrad.addColorStop(0.72, "rgba(255, 225, 140, 0.45)");
  sgrad.addColorStop(0.88, "rgba(255, 240, 190, 0.65)");
  sgrad.addColorStop(1.0, "rgba(255, 225, 140, 0.0)");
  sctx.fillStyle = sgrad;
  sctx.fillRect(0, 0, 256, 256);
  const centerSpotTex = new THREE.CanvasTexture(spotCanvas);
  const centerSpotPool = new THREE.Mesh(
    new THREE.CircleGeometry(2.65, 64),
    new THREE.MeshBasicMaterial({
      map: centerSpotTex,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  );
  centerSpotPool.rotation.x = -Math.PI / 2;
  centerSpotPool.position.y = 0.02;
  centerStageGroup.add(centerSpotPool);

  // 11692FonWDI 1:1 3D Pink, Rose & White Balloon Arch ("Balon Kemeri") behind Bride & Groom!
  const balloonArchGroup = new THREE.Group();
  balloonArchGroup.position.set(0, 0.1, -0.95);
  const balloonMats = [
    new THREE.MeshStandardMaterial({ color: 0xec4899, roughness: 0.24, metalness: 0.08 }),
    new THREE.MeshStandardMaterial({ color: 0xf9a8d4, roughness: 0.26, metalness: 0.06 }),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.22, metalness: 0.08 }),
  ];
  const balloonGeo = new THREE.SphereGeometry(0.22, 16, 14);
  const numBalloons = 25;
  for (let bi = 0; bi < numBalloons; bi++) {
    const t = bi / (numBalloons - 1);
    const ang = Math.PI * (1.0 - t); // Pi (left) to 0 (right)
    const bx = Math.cos(ang) * 1.92;
    const by = Math.sin(ang) * 2.75 + 0.18;
    const bz = Math.sin(bi * 1.7) * 0.06;

    const bMesh = new THREE.Mesh(balloonGeo, balloonMats[bi % balloonMats.length]);
    bMesh.position.set(bx, by, bz);
    bMesh.scale.set(1.0, 1.12, 1.0);
    bMesh.castShadow = true;
    balloonArchGroup.add(bMesh);
  }
  centerStageGroup.add(balloonArchGroup);
  scene.add(centerStageGroup);

  // 3. AUTHENTIC WEDDING BANQUET TABLES WITH TABLECLOTH, RUNNER, VASES, CANDLES & BENCHES!
  function addBanquetTable(x, z, rotY) {
    const grp = new THREE.Group();
    const clothMat = new THREE.MeshStandardMaterial({
      color: 0xf8f9fa,
      emissive: 0x222430,
      emissiveIntensity: 0.22,
      roughness: 0.65,
    });
    const runnerMat = new THREE.MeshStandardMaterial({
      color: 0xd97706,
      emissive: 0x78350f,
      emissiveIntensity: 0.35,
      roughness: 0.45,
    });
    const woodMat = new THREE.MeshStandardMaterial({
      color: 0x3d271d,
      roughness: 0.8,
    });
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      metalness: 0.85,
      roughness: 0.2,
    });

    // Main Table Top with draped cloth
    const tableTop = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.78, 1.15), clothMat);
    tableTop.position.y = 0.41;
    tableTop.castShadow = true;
    tableTop.receiveShadow = true;
    grp.add(tableTop);

    // Golden Satin Table Runner
    const runner = new THREE.Mesh(new THREE.BoxGeometry(3.32, 0.02, 0.38), runnerMat);
    runner.position.set(0, 0.805, 0);
    grp.add(runner);

    // 4 Wooden legs
    const legGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.78, 8);
    [[-1.5, -0.45], [1.5, -0.45], [-1.5, 0.45], [1.5, 0.45]].forEach(([lx, lz]) => {
      const leg = new THREE.Mesh(legGeo, woodMat);
      leg.position.set(lx, 0.39, lz);
      leg.castShadow = true;
      grp.add(leg);
    });

    // Centerpiece: Flower vase with roses
    const vase = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.06, 0.28, 12), goldMat);
    vase.position.set(0, 0.94, 0);
    grp.add(vase);

    const roseMat1 = new THREE.MeshStandardMaterial({ color: 0xec4899, roughness: 0.3 });
    const roseMat2 = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
    const roseGeo = new THREE.SphereGeometry(0.065, 8, 8);
    [[-0.05, 1.11, 0, roseMat1], [0.05, 1.11, 0, roseMat2], [0, 1.16, 0, roseMat1], [0, 1.10, 0.05, roseMat2]].forEach(([rx, ry, rz, rm]) => {
      const r = new THREE.Mesh(roseGeo, rm);
      r.position.set(rx, ry, rz);
      grp.add(r);
    });

    // 2 Glowing Wedding Candles with gentle flame
    const candleGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.16, 8);
    const candleMat = new THREE.MeshStandardMaterial({ color: 0xfef08a, roughness: 0.4 });
    const flameMat = new THREE.MeshBasicMaterial({ color: 0xfffbeb });
    [[-0.65, 0], [0.65, 0]].forEach(([cx, cz]) => {
      const c = new THREE.Mesh(candleGeo, candleMat);
      c.position.set(cx, 0.88, cz);
      const fl = new THREE.Mesh(new THREE.ConeGeometry(0.024, 0.065, 6), flameMat);
      fl.position.set(cx, 0.99, cz);
      grp.add(c, fl);
    });

    // 2 Rustic wooden benches behind the table
    const benchGeo = new THREE.BoxGeometry(1.35, 0.44, 0.32);
    [[-0.85, -0.88], [0.85, -0.88]].forEach(([bx, bz]) => {
      const b = new THREE.Mesh(benchGeo, woodMat);
      b.position.set(bx, 0.22, bz);
      b.castShadow = true;
      grp.add(b);
    });

    grp.position.set(x, 0, z);
    grp.rotation.y = rotY;
    scene.add(grp);
  }

  // Semi-circle of white wedding tables visible in 11692FonWDI (frame_34s.png)
  [
    [-11.8, -5.8, 0.85],
    [-8.4, -9.8, 0.48],
    [-0.2, -11.6, 0.0],
    [8.2, -9.6, -0.48],
    [11.6, -5.6, -0.85],
  ].forEach(([tx, tz, ry]) => addBanquetTable(tx, tz, ry));

  // 4. 3D BACKGROUND BUILDINGS ("BİNALAR") & DARK NIGHT TREES ("AĞAÇLAR") + HANGING FAIRY LIGHTS!
  function addBackgroundBuilding(x, z, w, h, d, rotY) {
    const bGrp = new THREE.Group();
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x1b1a29, roughness: 0.85 });
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x2d1822, roughness: 0.78 });
    const winMat = new THREE.MeshBasicMaterial({ color: 0xffde8a });

    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
    body.position.y = h * 0.5;
    bGrp.add(body);

    const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.72, 2.2, 4), roofMat);
    roof.position.y = h + 1.1;
    roof.rotation.y = Math.PI / 4;
    bGrp.add(roof);

    // Warm lit windows on the front facade
    const cols = Math.max(2, Math.floor(w / 1.8));
    const rows = Math.max(1, Math.floor(h / 2.2));
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const wx = (c - (cols - 1) * 0.5) * 1.45;
        const wy = 1.4 + r * 1.85;
        const win = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.72), winMat);
        win.position.set(wx, wy, d * 0.5 + 0.03);
        bGrp.add(win);
      }
    }

    bGrp.position.set(x, 0, z);
    bGrp.rotation.y = rotY;
    scene.add(bGrp);
  }

  addBackgroundBuilding(-15.5, -21.0, 6.2, 5.2, 4.2, 0.35);
  addBackgroundBuilding(0.0, -24.5, 7.8, 5.8, 4.6, 0.0);
  addBackgroundBuilding(15.5, -21.0, 6.2, 5.2, 4.2, -0.35);

  // Dark Night Trees ("Ağaçlar") framing the courtyard
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x141218, roughness: 0.95 });
  const canopyMat = new THREE.MeshStandardMaterial({ color: 0x132217, roughness: 0.9 });
  const treePositions = [
    [-12.5, -13.5, 1.1],
    [-6.2, -14.8, 1.18],
    [0.0, -15.2, 1.15],
    [6.4, -14.8, 1.18],
    [12.5, -13.5, 1.1],
  ];
  treePositions.forEach(([tx, tz, sc]) => {
    const tGrp = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.26, 6.8, 8), trunkMat);
    trunk.position.y = 3.4;
    tGrp.add(trunk);

    [
      [0, 7.2, 0, 2.6],
      [-1.5, 6.4, 0.4, 2.0],
      [1.5, 6.4, 0.4, 2.0],
    ].forEach(([cx, cy, cz, rad]) => {
      const crown = new THREE.Mesh(new THREE.SphereGeometry(rad, 12, 10), canopyMat);
      crown.position.set(cx, cy, cz);
      tGrp.add(crown);
    });

    tGrp.position.set(tx, 0, tz);
    tGrp.scale.setScalar(sc);
    scene.add(tGrp);
  });

  // 11692FonWDI 1:1 Draped Catenary Overhead Wedding String Lights ("Sarkıt Ampuller") across the night sky!
  const glowTex = createSoftGlowSpriteTexture();
  const fairyPositions = [];
  const stringLightSpans = [
    [-14.0, 8.8, -11.5, -5.5, 8.9, -12.5, 18],
    [-5.5, 8.9, -12.5, 2.5, 8.9, -12.5, 18],
    [2.5, 8.9, -12.5, 11.5, 8.8, -11.5, 18],
    [-12.5, 9.5, -8.5, 0.0, 9.6, -9.5, 22],
    [0.0, 9.6, -9.5, 12.5, 9.5, -8.5, 22],
  ];
  stringLightSpans.forEach(([x0, y0, z0, x1, y1, z1, steps]) => {
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const lx = x0 + (x1 - x0) * t;
      const lz = z0 + (z1 - z0) * t;
      const sag = Math.sin(t * Math.PI) * 1.15;
      const ly = y0 + (y1 - y0) * t - sag;
      fairyPositions.push(lx, ly, lz);
    }
  });

  const fairyGeo = new THREE.BufferGeometry();
  fairyGeo.setAttribute("position", new THREE.Float32BufferAttribute(fairyPositions, 3));
  const fairyMat = new THREE.PointsMaterial({
    size: 0.46,
    map: glowTex,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    opacity: 0.96,
  });
  scene.add(new THREE.Points(fairyGeo, fairyMat));

  const bassRingMat = new THREE.MeshBasicMaterial({
    color: 0xfbbf24,
    transparent: true,
    opacity: 0.0,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const bassRing = new THREE.Mesh(new THREE.RingGeometry(4.8, 5.05, 72), bassRingMat);
  bassRing.rotation.x = -Math.PI / 2;
  bassRing.position.set(0, 0.03, -0.55);
  scene.add(bassRing);

  const beamGeo = new THREE.ConeGeometry(2.6, 22, 20, 1, true);
  const feverBeams = [0xf59e0b, 0xec4899].map((col, idx) => {
    const bm = new THREE.MeshBasicMaterial({
      color: col,
      transparent: true,
      opacity: 0.0,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const mesh = new THREE.Mesh(beamGeo, bm);
    mesh.position.set(idx === 0 ? -9.5 : 9.5, 11.0, -8.5);
    scene.add(mesh);
    return mesh;
  });
  let feverTimer = 0;

  // 4 Rotating Stage Spotlights (Kır Düğünü Renkli Dönen Spotları)
  const spotColors = [0xef4444, 0x3b82f6, 0xa855f7, 0xf59e0b];
  const stageSpots = spotColors.map((col, idx) => {
    const ang = (idx / 4) * Math.PI * 2 + Math.PI * 0.25;
    const sx = Math.cos(ang) * 5.8;
    const sz = Math.sin(ang) * 5.8 - 0.55;

    const stand = new THREE.Mesh(
      new THREE.CylinderGeometry(0.10, 0.14, 1.4, 8),
      new THREE.MeshStandardMaterial({ color: 0x1f2937, metalness: 0.8, roughness: 0.3 })
    );
    stand.position.set(sx, 0.7, sz);
    stand.castShadow = true;
    scene.add(stand);

    const lampGroup = new THREE.Group();
    lampGroup.position.set(sx, 1.4, sz);

    const lamp = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.22, 0.38, 12),
      new THREE.MeshStandardMaterial({ color: 0x374151, metalness: 0.7 })
    );
    lamp.rotation.x = Math.PI / 2;
    lampGroup.add(lamp);

    const lens = new THREE.Mesh(
      new THREE.CircleGeometry(0.16, 16),
      new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide })
    );
    lens.position.z = 0.20;
    lampGroup.add(lens);

    const beam = new THREE.Mesh(
      new THREE.ConeGeometry(1.5, 9.8, 16, 1, true),
      new THREE.MeshBasicMaterial({
        color: col,
        transparent: true,
        opacity: 0.12,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    beam.rotation.x = -Math.PI / 2;
    beam.position.z = 4.9;
    lampGroup.add(beam);

    scene.add(lampGroup);
    return { lampGroup, beam, sx, sz, col, phase: idx * 1.57 };
  });

  // 3D DÜĞÜN TAKI SANDIĞI (Wedding Gift Chest on stage edge)
  const chestGroup = new THREE.Group();
  chestGroup.position.set(3.4, 0.05, 0.8);
  chestGroup.rotation.y = -Math.PI * 0.35;

  const chestBaseMat = new THREE.MeshStandardMaterial({
    color: 0x881337,
    roughness: 0.45,
    metalness: 0.1,
  });
  const chestGoldTrimMat = new THREE.MeshStandardMaterial({
    color: 0xfacc15,
    metalness: 0.9,
    roughness: 0.2,
  });

  const chestBody = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.44, 0.55), chestBaseMat);
  chestBody.position.y = 0.22;
  chestBody.castShadow = true;
  chestGroup.add(chestBody);

  const chestTrim1 = new THREE.Mesh(new THREE.BoxGeometry(0.87, 0.46, 0.08), chestGoldTrimMat);
  chestTrim1.position.y = 0.22;
  const chestTrim2 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.46, 0.57), chestGoldTrimMat);
  chestTrim2.position.y = 0.22;
  chestGroup.add(chestTrim1, chestTrim2);

  const chestLidPivot = new THREE.Group();
  chestLidPivot.position.set(0, 0.44, -0.27);

  const chestLid = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.28, 0.86, 16, 1, false, 0, Math.PI),
    chestBaseMat
  );
  chestLid.rotation.z = Math.PI / 2;
  chestLid.position.set(0, 0, 0.27);
  chestLid.castShadow = true;
  chestLidPivot.add(chestLid);

  const lock = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.04), chestGoldTrimMat);
  lock.position.set(0, 0, 0.55);
  chestLidPivot.add(lock);
  chestGroup.add(chestLidPivot);

  const goldMound = new THREE.Mesh(
    new THREE.SphereGeometry(0.24, 12, 8),
    new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.92, roughness: 0.15 })
  );
  goldMound.scale.set(1.5, 0.55, 0.9);
  goldMound.position.set(0, 0.38, 0);
  chestGroup.add(goldMound);

  scene.add(chestGroup);

  let chestOpenTimer = 0;
  function openGiftChest(duration = 3.5) {
    chestOpenTimer = Math.max(chestOpenTimer, duration);
    for (let c = 0; c < 28; c++) {
      const coinMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.08, 0.02, 12),
        chestGoldTrimMat
      );
      coinMesh.position.set(
        chestGroup.position.x + (Math.random() - 0.5) * 0.4,
        0.5 + Math.random() * 0.3,
        chestGroup.position.z + (Math.random() - 0.5) * 0.4
      );
      scene.add(coinMesh);
      particles.push({
        mesh: coinMesh,
        isSharedMat: false,
        vx: (Math.random() - 0.5) * 3.2,
        vy: 4.2 + Math.random() * 3.8,
        vz: (Math.random() - 0.5) * 3.2,
        gravity: 9.8,
        flutter: 0,
        life: 2.5,
      });
    }
  }

  function spawnFireworks(ox = 0, oz = -12) {
    const colors = [0xff0055, 0x00e5ff, 0xffd700, 0x76ff03, 0xff4081, 0xffffff];
    const col = colors[Math.floor(Math.random() * colors.length)];
    const sparkGeo = new THREE.SphereGeometry(0.065, 6, 6);
    const sparkMat = new THREE.MeshBasicMaterial({ color: col });
    const burstY = 12.0 + Math.random() * 4.0;
    const burstX = ox + (Math.random() - 0.5) * 10;
    const burstZ = oz + (Math.random() - 0.5) * 6;

    for (let i = 0; i < 65; i++) {
      const m = new THREE.Mesh(sparkGeo, sparkMat);
      m.position.set(burstX, burstY, burstZ);
      scene.add(m);

      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      const speed = 4.5 + Math.random() * 4.5;
      particles.push({
        mesh: m,
        isSharedMat: true,
        vx: Math.sin(phi) * Math.cos(theta) * speed,
        vy: Math.cos(phi) * speed * 0.8,
        vz: Math.sin(phi) * Math.sin(theta) * speed,
        gravity: 4.5,
        flutter: 0,
        life: 1.8 + Math.random() * 0.8,
      });
    }
  }

  function spawnMesale(ox = -4.5, oz = -2.5) {
    const flareGeo = new THREE.PlaneGeometry(0.18, 0.18);
    const flareColors = [0xef4444, 0xf97316, 0xfacc15];
    for (let i = 0; i < 45; i++) {
      const col = flareColors[i % flareColors.length];
      const m = new THREE.Mesh(flareGeo, new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide }));
      m.position.set(ox + (Math.random() - 0.5) * 0.3, 0.4 + Math.random() * 0.4, oz + (Math.random() - 0.5) * 0.3);
      scene.add(m);
      particles.push({
        mesh: m,
        isSharedMat: false,
        vx: (Math.random() - 0.5) * 2.2,
        vy: 4.8 + Math.random() * 3.8,
        vz: (Math.random() - 0.5) * 2.2,
        gravity: 7.2,
        flutter: 1.2,
        life: 1.2 + Math.random() * 0.8,
      });
    }
  }

  // 5. 3D CONFETTI ("KONFETİ PAT PAT") & 3D DOLLAR BILL RAIN ("PARA SAÇ" 500 COINS)
  const particles = [];
  const confettiGeo = new THREE.PlaneGeometry(0.24, 0.15);
  const dollarGeo = new THREE.PlaneGeometry(0.56, 0.28);
  const dollarTex = createDollarBillTexture();
  const dollarMatShared = new THREE.MeshBasicMaterial({
    map: dollarTex,
    side: THREE.DoubleSide,
  });

  function spawnCelebration(originPos, count = 55, goldOnly = false) {
    const palette = goldOnly
      ? [0xfacc15, 0xfde047, 0xf59e0b]
      : [0xfacc15, 0xf43f5e, 0x38bdf8, 0x4ade80, 0xe879f9, 0xffffff];
    const ox = originPos?.x || 0;
    const oy = originPos?.y || 2.0;
    const oz = originPos?.z || -0.5;
    for (let i = 0; i < count; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: palette[i % palette.length], side: THREE.DoubleSide });
      const m = new THREE.Mesh(confettiGeo, mat);
      m.position.set(
        ox + (Math.random() - 0.5) * 2.2,
        oy + 2.2 + Math.random() * 1.8,
        oz + (Math.random() - 0.5) * 2.2
      );
      scene.add(m);
      particles.push({
        mesh: m,
        isSharedMat: false,
        vx: (Math.random() - 0.5) * 5.6,
        vy: 3.6 + Math.random() * 5.6,
        vz: (Math.random() - 0.5) * 5.6,
        gravity: 8.8,
        flutter: 0,
        life: 2.8 + Math.random() * 1.2,
      });
    }
  }

  function spawnMoneyRain(count = 110) {
    // 11692FonWDI frame_24s.png 1:1 — Green 3D Dollar Bills raining across the entire stage!
    for (let i = 0; i < count; i++) {
      const m = new THREE.Mesh(dollarGeo, dollarMatShared);
      m.position.set(
        (Math.random() - 0.5) * 16.5,
        7.5 + Math.random() * 9.5,
        -4.5 + Math.random() * 11.5
      );
      m.rotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI
      );
      scene.add(m);
      particles.push({
        mesh: m,
        isSharedMat: true,
        vx: (Math.random() - 0.5) * 1.4,
        vy: -1.8 - Math.random() * 1.6,
        vz: (Math.random() - 0.5) * 1.2,
        gravity: 0.45,
        flutter: 2.5 + Math.random() * 2.5,
        phase: Math.random() * Math.PI * 2,
        life: 5.5 + Math.random() * 2.5,
      });
    }
  }

  function triggerFever(duration = 6.5) {
    feverTimer = Math.max(feverTimer, duration);
    spawnMoneyRain(95);
    spawnCelebration(new THREE.Vector3(0, 2.4, -0.5), 75, false);
  }

  function updateWorld(time, dt, beatEnergy = 0) {
    fairyMat.opacity = 0.88 + Math.sin(time * 2.8) * 0.10 + beatEnergy * 0.08;
    const pulseScale = 1.0 + beatEnergy * 0.085;
    bassRing.scale.set(pulseScale, pulseScale, 1);
    bassRingMat.opacity = feverTimer > 0 ? Math.min(0.32, feverTimer * 0.1) + beatEnergy * 0.15 : 0.0;

    if (feverTimer > 0) {
      feverTimer = Math.max(0, feverTimer - dt);
      feverBeams.forEach((bm, idx) => {
        bm.material.opacity = Math.min(0.22, feverTimer * 0.12);
        bm.rotation.z = (idx === 0 ? -0.35 : 0.35) + Math.sin(time * 3.6 + idx * 2.1) * 0.38;
        bm.rotation.x = 0.22 + Math.cos(time * 2.7 + idx) * 0.15;
      });
    } else {
      feverBeams.forEach((bm) => { bm.material.opacity = 0; });
    }

    // Rotate sweeping spotlights
    stageSpots.forEach((s) => {
      const sweep = Math.sin(time * 1.8 + s.phase) * 0.45;
      s.lampGroup.rotation.y = sweep;
      s.lampGroup.rotation.x = Math.PI / 4 + Math.cos(time * 1.2 + s.phase) * 0.15;
    });

    // Animate Chest Lid
    if (chestOpenTimer > 0) {
      chestOpenTimer = Math.max(0, chestOpenTimer - dt);
      const targetRot = Math.min(1.4, chestOpenTimer * 1.8);
      chestLidPivot.rotation.x = -targetRot;
    } else {
      chestLidPivot.rotation.x += (0 - chestLidPivot.rotation.x) * Math.min(1, dt * 6);
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      p.vy -= (p.gravity !== undefined ? p.gravity : 9.2) * dt;
      if (p.flutter) {
        p.mesh.position.x += (p.vx + Math.sin(time * p.flutter + (p.phase || 0)) * 1.35) * dt;
      } else {
        p.mesh.position.x += p.vx * dt;
      }
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;
      p.mesh.rotation.x += 3.8 * dt;
      p.mesh.rotation.y += 4.2 * dt;
      if (p.life <= 0 || p.mesh.position.y < 0.05) {
        scene.remove(p.mesh);
        if (!p.isSharedMat && p.mesh.material) {
          p.mesh.material.dispose();
        }
        particles.splice(i, 1);
      }
    }
  }

  return {
    updateWorld,
    spawnCelebration,
    spawnMoneyRain,
    triggerFever,
    openGiftChest,
    spawnFireworks,
    spawnMesale,
  };
}
