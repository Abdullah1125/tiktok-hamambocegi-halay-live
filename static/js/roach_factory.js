import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const avatarCache = new Map();
const gltfLoader = new GLTFLoader();

// SlimeTiktok Rigged 3D Cockroach Model + Mixamo Skeleton
const SLIME_ROACH_URL = "/static/models/roaches/slime_roach.glb?v=98";
const MODEL_SCALE = 2.42; // Converts 0.78m model head height -> ~1.89m stage height

let slimeRoachTemplate = null;
let slimeRoachWaiter = null;

// Pre-allocated scratch math objects (zero per-frame GC pressure for 60 FPS TikTok LIVE Studio)
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _v4 = new THREE.Vector3();
const _v5 = new THREE.Vector3();
const _v6 = new THREE.Vector3();
const _v7 = new THREE.Vector3();
const _v8 = new THREE.Vector3();
const _v9 = new THREE.Vector3();
const _v10 = new THREE.Vector3();
const _q1 = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _q3 = new THREE.Quaternion();
const _q4 = new THREE.Quaternion();
const _X_AXIS = new THREE.Vector3(1, 0, 0);
const _Y_AXIS = new THREE.Vector3(0, 1, 0);
const _Z_AXIS = new THREE.Vector3(0, 0, 1);

const FINGERS = ["Thumb", "Index", "Middle", "Ring", "Pinky"];

export const ROACH_GLB_KEYS = [
  "fez_yelek",
  "kasket_yelek",
  "kahve_kasket_yelek",
  "bindalli_pembe",
  "yesil_yazma_bindalli",
  "sari_yazma_bindalli",
  "bride_fiyonk",
  "groom_tophat",
  "takim_elbise",
  "yazmali_anne",
  "pala_biyik_atlet",
  "mavi_gomlek",
  "beyaz_tisort",
  "doktor_onluk",
  "pembe_fiyonk",
  "zincirli_keko",
  "kareli_onluk",
  "sapkali_cocuk",
  "klasik_bocek",
];

export const HALAY_CHARACTER_POOL = [
  "fez_yelek",
  "bindalli_pembe",
  "kasket_yelek",
  "yesil_yazma_bindalli",
  "kahve_kasket_yelek",
  "sari_yazma_bindalli",
  "takim_elbise",
  "yazmali_anne",
  "pala_biyik_atlet",
  "mavi_gomlek",
  "beyaz_tisort",
  "doktor_onluk",
  "pembe_fiyonk",
  "zincirli_keko",
  "kareli_onluk",
  "sapkali_cocuk",
  "klasik_bocek",
];

function cloneSkinnedScene(source) {
  const sourceLookup = new Map();
  const cloneLookup = new Map();
  const clone = source.clone(true);

  const parallelTraverse = (a, b, cb) => {
    cb(a, b);
    const len = Math.min(a.children.length, b.children.length);
    for (let i = 0; i < len; i++) {
      parallelTraverse(a.children[i], b.children[i], cb);
    }
  };

  parallelTraverse(source, clone, (srcNode, clonedNode) => {
    sourceLookup.set(clonedNode, srcNode);
    cloneLookup.set(srcNode, clonedNode);
  });

  clone.traverse((node) => {
    if (!node.isSkinnedMesh) return;
    const clonedMesh = node;
    const sourceMesh = sourceLookup.get(node);
    const sourceBones = sourceMesh.skeleton.bones;

    clonedMesh.skeleton = sourceMesh.skeleton.clone();
    clonedMesh.bindMatrix.copy(sourceMesh.bindMatrix);
    clonedMesh.skeleton.bones = sourceBones.map((bone) => cloneLookup.get(bone));
    clonedMesh.bind(clonedMesh.skeleton, clonedMesh.bindMatrix);
    clonedMesh.frustumCulled = false;
  });

  return clone;
}

/** Rotates `bone` in world space by `deltaQuat`, updating its matrixWorld cleanly. */
function turnWorld(bone, deltaQuat) {
  if (!bone || !bone.parent) return;
  bone.getWorldQuaternion(_q2);
  _q3.copy(deltaQuat).multiply(_q2);
  bone.parent.getWorldQuaternion(_q2).invert();
  bone.quaternion.copy(_q2.multiply(_q3));
  bone.updateMatrixWorld(true);
}

/** Minimal-twist rotation turning `bone -> child` vector toward `wantWorldDir`. */
function aimBone(bone, child, wantWorldDir) {
  bone.getWorldPosition(_v1);
  child.getWorldPosition(_v2);
  const have = _v2.sub(_v1).normalize();
  const to = _v3.copy(wantWorldDir).normalize();
  if (have.dot(to) < -0.999) return;
  _q1.setFromUnitVectors(have, to);
  turnWorld(bone, _q1);
}

/**
 * Analytic Two-Bone IK solver in world space (works identically on Arms and Legs
 * regardless of arbitrary Tripo/Mixamo bone roll).
 */
function solveTwoBoneIK(upperBone, midBone, endBone, targetWorld, poleWorld, weight = 1.0, preserveEndRot = true) {
  if (!upperBone || !midBone || !endBone || weight <= 0.001) return;
  upperBone.getWorldPosition(_v4); // a (shoulder / hip)
  midBone.getWorldPosition(_v5);   // b (elbow / knee)
  endBone.getWorldPosition(_v6);   // c (wrist / ankle)

  const l1 = _v4.distanceTo(_v5);
  const l2 = _v5.distanceTo(_v6);
  if (l1 < 1e-4 || l2 < 1e-4) return;

  _v7.lerpVectors(_v6, targetWorld, Math.min(1, weight)); // blended target
  _v8.copy(_v7).sub(_v4); // a -> target
  const rawDist = _v8.length();
  const d = THREE.MathUtils.clamp(rawDist, Math.abs(l1 - l2) + 1e-4, (l1 + l2) * 0.992);
  if (rawDist < 1e-5) return;
  _v8.multiplyScalar(d / rawDist);

  const cosA = THREE.MathUtils.clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1);
  const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
  _v9.copy(_v8).normalize(); // along

  // Orthogonal bend direction toward pole
  _v10.copy(poleWorld).sub(_v4);
  _v10.addScaledVector(_v9, -_v10.dot(_v9));
  if (_v10.lengthSq() < 1e-6) _v10.set(0, 0, 1);
  else _v10.normalize();

  // Desired mid-joint (elbow/knee) world position
  const midTargetX = _v4.x + _v9.x * (l1 * cosA) + _v10.x * (l1 * sinA);
  const midTargetY = _v4.y + _v9.y * (l1 * cosA) + _v10.y * (l1 * sinA);
  const midTargetZ = _v4.z + _v9.z * (l1 * cosA) + _v10.z * (l1 * sinA);

  if (preserveEndRot) {
    endBone.getWorldQuaternion(_q4);
  }

  _v7.set(midTargetX - _v4.x, midTargetY - _v4.y, midTargetZ - _v4.z);
  aimBone(upperBone, midBone, _v7);

  midBone.getWorldPosition(_v5);
  _v7.set(_v4.x + _v8.x - _v5.x, _v4.y + _v8.y - _v5.y, _v4.z + _v8.z - _v5.z);
  aimBone(midBone, endBone, _v7);

  if (preserveEndRot && endBone.parent) {
    endBone.parent.getWorldQuaternion(_q2).invert();
    endBone.quaternion.copy(_q2.multiply(_q4));
    endBone.updateMatrixWorld(true);
  }
}

function loadSlimeRoachTemplate() {
  if (slimeRoachTemplate) return Promise.resolve(slimeRoachTemplate);
  if (slimeRoachWaiter) return slimeRoachWaiter;

  slimeRoachWaiter = new Promise((resolve) => {
    gltfLoader.load(
      SLIME_ROACH_URL,
      (gltf) => {
        gltf.scene.traverse((o) => {
          if (o.isMesh) {
            o.castShadow = true;
            o.receiveShadow = true;
            o.frustumCulled = false;
            if (o.material) {
              const mat = o.material;
              if (mat.map) {
                mat.map.colorSpace = THREE.SRGBColorSpace;
                mat.map.anisotropy = 4;
              }
              mat.roughness = 0.54;
              mat.metalness = 0.06;
              mat.emissive = new THREE.Color(0x3a1c08);
              mat.emissiveIntensity = 0.22;
              mat.needsUpdate = true;
            }
          }
        });

        // Strip horizontal root drift so characters stay anchored to exact Halay / Walk coordinates
        for (const clip of gltf.animations || []) {
          clip.tracks = clip.tracks.filter(
            (t) => !(t.name.endsWith(".position") && !t.name.includes("Hips")) && !t.name.endsWith(".scale")
          );
          for (const t of clip.tracks) {
            if (t.name.includes("Hips") && t.name.endsWith(".position")) {
              const v = t.values;
              const x0 = v[0] ?? 0;
              const z0 = v[2] ?? 0;
              for (let i = 0; i < v.length; i += 3) {
                v[i] = x0;
                v[i + 2] = z0;
              }
            }
          }
        }

        slimeRoachTemplate = gltf;
        resolve(gltf);
      },
      undefined,
      (err) => {
        console.error("[RoachFactory] Failed to load slime_roach.glb:", err);
        resolve(null);
      }
    );
  });
  return slimeRoachWaiter;
}

loadSlimeRoachTemplate();

export function generateAvatarDataUrl(seedText = "User") {
  const key = (seedText || "U").slice(0, 16);
  if (avatarCache.has(key)) return avatarCache.get(key);

  const c = document.createElement("canvas");
  c.width = 96;
  c.height = 96;
  const ctx = c.getContext("2d");

  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = key.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;

  const grad = ctx.createLinearGradient(0, 0, 96, 96);
  grad.addColorStop(0, `hsl(${hue}, 78%, 48%)`);
  grad.addColorStop(1, `hsl(${(hue + 40) % 360}, 82%, 30%)`);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(48, 48, 46, 0, Math.PI * 2);
  ctx.fill();

  ctx.lineWidth = 4;
  ctx.strokeStyle = "rgba(255,255,255,0.85)";
  ctx.stroke();

  ctx.fillStyle = "#ffffff";
  ctx.font = "800 40px 'Plus Jakarta Sans', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const initials = key.replace(/[^a-zA-Z0-9ğüşöçıİĞÜŞÖÇ]/g, "").slice(0, 2).toUpperCase() || "🪳";
  ctx.fillText(initials, 48, 50);

  const url = c.toDataURL("image/png");
  avatarCache.set(key, url);
  return url;
}

let _styleCursor = 0;
function resolveRoachModelKey(rawOutfit) {
  if (ROACH_GLB_KEYS.includes(rawOutfit)) return rawOutfit;
  if (rawOutfit === "bride") return "bride_fiyonk";
  if (rawOutfit === "groom") return "groom_tophat";
  if (rawOutfit === "halaybasi") return "fez_yelek";
  if (rawOutfit === "suit") return "takim_elbise";
  if (rawOutfit === "davulcu") return "fez_yelek";
  if (rawOutfit === "zurnaci") return "kasket_yelek";
  if (rawOutfit === "athletic" || rawOutfit === "efe") return "pala_biyik_atlet";
  if (rawOutfit === "casual" || rawOutfit === "winter") return "mavi_gomlek";
  if (rawOutfit === "fancy" || rawOutfit === "gold") return "zincirli_keko";
  if (rawOutfit === "chef") return "doktor_onluk";
  if (rawOutfit === "dress" || rawOutfit === "summer") return "bindalli_pembe";

  const picked = HALAY_CHARACTER_POOL[_styleCursor % HALAY_CHARACTER_POOL.length];
  _styleCursor++;
  return picked;
}

function buildMustacheMesh(colorHex = 0x1c1008) {
  const grp = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.45 });
  [-1, 1].forEach((side) => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 0.01, 0, 0),
      new THREE.Vector3(side * 0.08, -0.01, -0.01),
      new THREE.Vector3(side * 0.15, 0.025, -0.03),
    ]);
    const m = new THREE.Mesh(new THREE.TubeGeometry(curve, 10, 0.022, 8, false), mat);
    grp.add(m);
  });
  return grp;
}

function buildVestPanels(vestColorHex, trimColorHex = 0xfacc15) {
  const grp = new THREE.Group();
  const vestMat = new THREE.MeshStandardMaterial({ color: vestColorHex, roughness: 0.48, side: THREE.DoubleSide });
  const trimMat = new THREE.MeshStandardMaterial({ color: trimColorHex, metalness: 0.65, roughness: 0.25 });
  [-1, 1].forEach((side) => {
    const panel = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.38, 0.26), vestMat);
    panel.position.set(side * 0.16, -0.02, 0.04);
    panel.rotation.y = side * 0.12;
    grp.add(panel);

    const trim = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.38, 0.03), trimMat);
    trim.position.set(side * 0.085, -0.02, 0.175);
    grp.add(trim);
  });
  return grp;
}

function decorateSlimeRoachBones(modelKey, instType, anchors) {
  const { headDecor, snoutDecor, chestDecor, hipsDecor, rPalmDecor, lPalmDecor, root } = anchors;

  // 1. Headwear & Facial Character Props
  if (modelKey === "bride_fiyonk") {
    const veil = new THREE.Mesh(
      new THREE.ConeGeometry(0.42, 1.24, 18, 1, true),
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.66,
        roughness: 0.25,
        side: THREE.DoubleSide,
      })
    );
    veil.position.set(0, -0.38, -0.20);
    veil.rotation.x = 0.24;
    headDecor.add(veil);

    const bowMat = new THREE.MeshStandardMaterial({ color: 0xf472b6, emissive: 0xdb2777, emissiveIntensity: 0.25, roughness: 0.3 });
    [-1, 1].forEach((s) => {
      const loop = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 10), bowMat);
      loop.scale.set(1.3, 0.85, 0.55);
      loop.position.set(s * 0.09, 0.05, 0.04);
      headDecor.add(loop);
    });
    const knot = new THREE.Mesh(new THREE.SphereGeometry(0.042, 10, 10), bowMat);
    knot.position.set(0, 0.05, 0.06);
    headDecor.add(knot);

    const tiara = new THREE.Mesh(
      new THREE.TorusGeometry(0.16, 0.018, 10, 28, Math.PI),
      new THREE.MeshStandardMaterial({ color: 0xfde047, emissive: 0xfacc15, emissiveIntensity: 0.65, metalness: 0.85, roughness: 0.18 })
    );
    tiara.position.set(0, 0.07, 0.05);
    tiara.rotation.x = Math.PI * 0.36;
    headDecor.add(tiara);

    // Dainty Bridal Bouquet in outer (right) hand
    const bouquet = new THREE.Group();
    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.014, 0.16, 8),
      new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.5 })
    );
    stem.position.y = -0.04;
    bouquet.add(stem);
    const wrap = new THREE.Mesh(
      new THREE.ConeGeometry(0.09, 0.12, 12),
      new THREE.MeshStandardMaterial({ color: 0xfdf2f8, roughness: 0.35 })
    );
    wrap.rotation.x = Math.PI;
    wrap.position.y = 0.04;
    bouquet.add(wrap);
    const roseColors = [0xf43f5e, 0xfda4af, 0xffffff, 0xfbbf24, 0xf472b6];
    for (let r = 0; r < 5; r++) {
      const ang = (r / 5) * Math.PI * 2;
      const rose = new THREE.Mesh(
        new THREE.SphereGeometry(0.036, 8, 8),
        new THREE.MeshStandardMaterial({ color: roseColors[r], roughness: 0.35 })
      );
      rose.position.set(Math.cos(ang) * 0.04, 0.10 + (r === 2 ? 0.02 : 0), Math.sin(ang) * 0.04);
      bouquet.add(rose);
    }
    rPalmDecor.add(bouquet);
  } else if (modelKey === "groom_tophat") {
    const hatMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.28, metalness: 0.15 });
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.032, 24), hatMat);
    brim.position.set(0, 0.01, 0);
    const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.195, 0.18, 0.32, 24), hatMat);
    cyl.position.set(0, 0.17, 0);
    const band = new THREE.Mesh(
      new THREE.CylinderGeometry(0.188, 0.185, 0.052, 24),
      new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.35 })
    );
    band.position.set(0, 0.052, 0);
    headDecor.add(brim, cyl, band);

    const stache = buildMustacheMesh(0x18100c);
    snoutDecor.add(stache);
  } else if (modelKey === "fez_yelek") {
    const fez = new THREE.Mesh(
      new THREE.CylinderGeometry(0.165, 0.205, 0.25, 22),
      new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.42 })
    );
    fez.position.set(0, 0.11, 0);
    const tassel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.015, 0.04, 0.20, 8),
      new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.6 })
    );
    tassel.position.set(0.16, 0.12, -0.04);
    tassel.rotation.z = -0.35;
    headDecor.add(fez, tassel);

    const stache = buildMustacheMesh(0x1f1209);
    snoutDecor.add(stache);
  } else if (modelKey === "kasket_yelek" || modelKey === "kahve_kasket_yelek") {
    const capColor = modelKey === "kahve_kasket_yelek" ? 0x78350f : 0x334155;
    const capMat = new THREE.MeshStandardMaterial({ color: capColor, roughness: 0.55 });
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.22, 18, 12), capMat);
    dome.scale.set(1.0, 0.48, 1.12);
    dome.position.set(0, 0.04, 0.02);
    const visor = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.025, 18), capMat);
    visor.scale.set(0.95, 1, 0.75);
    visor.position.set(0, 0.0, 0.15);
    visor.rotation.x = 0.18;
    headDecor.add(dome, visor);

    const stache = buildMustacheMesh(0x27170c);
    snoutDecor.add(stache);
  } else if (
    modelKey === "bindalli_pembe" ||
    modelKey === "yesil_yazma_bindalli" ||
    modelKey === "sari_yazma_bindalli" ||
    modelKey === "yazmali_anne"
  ) {
    const scarfColor =
      modelKey === "bindalli_pembe"
        ? 0xec4899
        : modelKey === "yesil_yazma_bindalli"
        ? 0x10b981
        : modelKey === "sari_yazma_bindalli"
        ? 0xfacc15
        : 0xf1f5f9;
    const scarfMat = new THREE.MeshStandardMaterial({ color: scarfColor, roughness: 0.4, side: THREE.DoubleSide });
    const hood = new THREE.Mesh(new THREE.SphereGeometry(0.245, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.62), scarfMat);
    hood.position.set(0, -0.06, -0.02);
    hood.rotation.x = -0.25;
    headDecor.add(hood);

    const coinMat = new THREE.MeshStandardMaterial({ color: 0xfde047, metalness: 0.85, roughness: 0.2 });
    for (let i = -3; i <= 3; i++) {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.008, 10), coinMat);
      c.rotation.x = Math.PI / 2;
      c.position.set(i * 0.055, 0.02 - Math.abs(i) * 0.006, 0.19 - Math.abs(i) * 0.012);
      headDecor.add(c);
    }
  } else if (modelKey === "pembe_fiyonk") {
    const bowMat = new THREE.MeshStandardMaterial({ color: 0xf472b6, roughness: 0.35 });
    [-1, 1].forEach((s) => {
      const loop = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 10), bowMat);
      loop.scale.set(1.25, 0.8, 0.5);
      loop.position.set(s * 0.085, 0.05, 0.04);
      headDecor.add(loop);
    });
  } else if (modelKey === "sapkali_cocuk") {
    const capMat = new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.45 });
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.21, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), capMat);
    dome.position.set(0, 0.01, 0);
    const visor = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.022, 0.16),
      new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.45 })
    );
    visor.position.set(0, 0.01, 0.18);
    headDecor.add(dome, visor);
  } else if (modelKey === "pala_biyik_atlet") {
    const stache = buildMustacheMesh(0x110a05);
    stache.scale.setScalar(1.3);
    snoutDecor.add(stache);
  }

  // 2. Torso & Skirt Wedding Outfits
  if (modelKey === "bride_fiyonk") {
    const gownMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xf8fafc,
      emissiveIntensity: 0.16,
      roughness: 0.32,
      side: THREE.DoubleSide,
    });
    const bodice = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.22, 0.36, 20), gownMat);
    bodice.scale.set(1.06, 1, 0.88);
    bodice.position.set(0, -0.02, 0.04);
    chestDecor.add(bodice);

    const skirt = new THREE.Mesh(new THREE.ConeGeometry(0.54, 0.78, 24, 1, false), gownMat);
    skirt.scale.set(1.04, 1, 0.96);
    skirt.position.set(0, -0.30, 0.04);
    hipsDecor.add(skirt);

    const waistBelt = new THREE.Mesh(
      new THREE.TorusGeometry(0.24, 0.028, 10, 24),
      new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.32 })
    );
    waistBelt.rotation.x = Math.PI / 2;
    waistBelt.scale.set(1.08, 0.92, 1);
    waistBelt.position.set(0, 0.06, 0.08);
    hipsDecor.add(waistBelt);
  } else if (modelKey === "groom_tophat" || modelKey === "takim_elbise") {
    const suitPanel = buildVestPanels(0x111827, 0xffffff);
    chestDecor.add(suitPanel);

    const shirt = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.34, 0.04),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35 })
    );
    shirt.position.set(0, 0.0, 0.165);
    chestDecor.add(shirt);

    const tieMat = new THREE.MeshStandardMaterial({
      color: modelKey === "groom_tophat" ? 0xdc2626 : 0x2563eb,
      roughness: 0.35,
    });
    if (modelKey === "groom_tophat") {
      [-1, 1].forEach((s) => {
        const wing = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.045, 0.03), tieMat);
        wing.position.set(s * 0.04, 0.13, 0.195);
        wing.rotation.z = -s * 0.2;
        chestDecor.add(wing);
      });
    } else {
      const tie = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.24, 0.03), tieMat);
      tie.position.set(0, 0.02, 0.192);
      chestDecor.add(tie);
    }
  } else if (modelKey === "fez_yelek") {
    chestDecor.add(buildVestPanels(0x991b1b, 0xfacc15));
  } else if (modelKey === "kasket_yelek") {
    chestDecor.add(buildVestPanels(0x1e3a8a, 0xfacc15));
  } else if (modelKey === "kahve_kasket_yelek") {
    chestDecor.add(buildVestPanels(0x78350f, 0xfbbf24));
  } else if (
    modelKey === "bindalli_pembe" ||
    modelKey === "yesil_yazma_bindalli" ||
    modelKey === "sari_yazma_bindalli"
  ) {
    const dressColor =
      modelKey === "bindalli_pembe"
        ? 0xdb2777
        : modelKey === "yesil_yazma_bindalli"
        ? 0x059669
        : 0xd97706;
    chestDecor.add(buildVestPanels(dressColor, 0xfde047));
    const skirt = new THREE.Mesh(
      new THREE.ConeGeometry(0.45, 0.64, 20),
      new THREE.MeshStandardMaterial({ color: dressColor, roughness: 0.42 })
    );
    skirt.scale.set(1.0, 1, 0.88);
    skirt.position.set(0, -0.24, 0.03);
    hipsDecor.add(skirt);

    const belt = new THREE.Mesh(
      new THREE.TorusGeometry(0.24, 0.028, 10, 24),
      new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.8, roughness: 0.2 })
    );
    belt.rotation.x = Math.PI / 2;
    belt.scale.set(1.02, 0.86, 1);
    belt.position.set(0, 0.06, 0.03);
    hipsDecor.add(belt);
  } else if (modelKey === "yazmali_anne" || modelKey === "kareli_onluk") {
    const apron = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.46, 0.04),
      new THREE.MeshStandardMaterial({ color: modelKey === "yazmali_anne" ? 0xf8fafc : 0xfca5a5, roughness: 0.5 })
    );
    apron.position.set(0, -0.10, 0.18);
    hipsDecor.add(apron);
  } else if (modelKey === "mavi_gomlek") {
    chestDecor.add(buildVestPanels(0x0284c7, 0xe0f2fe));
  } else if (modelKey === "beyaz_tisort" || modelKey === "pala_biyik_atlet") {
    const singlet = new THREE.Mesh(
      new THREE.CylinderGeometry(0.24, 0.23, 0.34, 18),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.45 })
    );
    singlet.scale.set(1.04, 1, 0.82);
    singlet.position.set(0, -0.02, 0.04);
    chestDecor.add(singlet);
  } else if (modelKey === "doktor_onluk") {
    chestDecor.add(buildVestPanels(0xf8fafc, 0x38bdf8));
  } else if (modelKey === "zincirli_keko") {
    const chain = new THREE.Mesh(
      new THREE.TorusGeometry(0.18, 0.024, 10, 24),
      new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.9, roughness: 0.15 })
    );
    chain.position.set(0, 0.08, 0.14);
    chain.rotation.x = 0.65;
    chestDecor.add(chain);
  }

  // 3. Musician Instruments with Exact IK Target Nodes
  if (instType === "davul") {
    const davulGroup = new THREE.Group();
    const drumShell = new THREE.Mesh(
      new THREE.CylinderGeometry(0.32, 0.32, 0.28, 28),
      new THREE.MeshStandardMaterial({ color: 0xe11d48, roughness: 0.42 })
    );
    drumShell.rotation.z = Math.PI / 2;

    const drumSkin = new THREE.Mesh(
      new THREE.CylinderGeometry(0.305, 0.305, 0.295, 28),
      new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff8eb, emissiveIntensity: 0.25, roughness: 0.55 })
    );
    drumSkin.rotation.z = Math.PI / 2;

    const rimMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.45, roughness: 0.32 });
    const rightRim = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.020, 10, 28), rimMat);
    rightRim.rotation.y = Math.PI / 2;
    rightRim.position.x = -0.14;
    const leftRim = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.020, 10, 28), rimMat);
    leftRim.rotation.y = Math.PI / 2;
    leftRim.position.x = 0.14;

    // Shoulder strap slinging the davul across the chest
    const strap = new THREE.Mesh(
      new THREE.TorusGeometry(0.32, 0.016, 8, 24, Math.PI * 1.25),
      new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.6 })
    );
    strap.position.set(0.04, 0.18, -0.16);
    strap.rotation.set(0.45, 0.35, -0.55);

    // Exact 3D target nodes on the drum for Two-Bone Arm IK:
    // In character space (+X is character left, -X is character right, +Z is forward):
    // Right hand strikes right-side drumhead (-X) with Tokmak; Left hand taps top/left rim (+X/+Y) with Çubuk!
    const strikeNode = new THREE.Object3D();
    strikeNode.position.set(-0.22, -0.02, 0.10);
    const windupNode = new THREE.Object3D();
    windupNode.position.set(-0.46, 0.18, 0.14);
    const rimTapNode = new THREE.Object3D();
    rimTapNode.position.set(0.18, 0.24, 0.10);
    const rimRestNode = new THREE.Object3D();
    rimRestNode.position.set(0.28, 0.32, 0.14);

    davulGroup.add(drumShell, drumSkin, rightRim, leftRim, strap, strikeNode, windupNode, rimTapNode, rimRestNode);
    // Slung diagonally across belly/lower chest just like authentic Anatolian Davulcu
    davulGroup.position.set(0.02, -0.22, 0.21);
    davulGroup.rotation.set(0.08, 0.32, -0.12);
    chestDecor.add(davulGroup);
    root.userData.davulGroup = davulGroup;
    root.userData.davulNodes = { strikeNode, windupNode, rimTapNode, rimRestNode };

    // Tokmak in Right Fist (+Y in palm socket points out of thumb side of closed fist)
    const tokmak = new THREE.Group();
    const tStick = new THREE.Mesh(
      new THREE.CylinderGeometry(0.016, 0.013, 0.28, 8),
      new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.5 })
    );
    tStick.position.y = 0.11;
    const tHead = new THREE.Mesh(
      new THREE.SphereGeometry(0.046, 10, 10),
      new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.45 })
    );
    tHead.scale.set(1.0, 1.25, 1.0);
    tHead.position.y = 0.25;
    tokmak.add(tStick, tHead);
    rPalmDecor.add(tokmak);

    // Thin Çubuk switch in Left Fist
    const cubuk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.006, 0.009, 0.32, 6),
      new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.35 })
    );
    cubuk.position.y = 0.14;
    lPalmDecor.add(cubuk);
  } else if (instType === "zurna") {
    const zurnaGroup = new THREE.Group();
    const pipe = new THREE.Mesh(
      new THREE.CylinderGeometry(0.016, 0.032, 0.38, 12),
      new THREE.MeshStandardMaterial({ color: 0x92400e, metalness: 0.35, roughness: 0.32 })
    );
    pipe.rotation.x = Math.PI / 2 + 0.26;
    pipe.position.set(0, 0.19, 0.34);

    const bell = new THREE.Mesh(
      new THREE.ConeGeometry(0.108, 0.15, 16, 1, true),
      new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.78, roughness: 0.20, side: THREE.DoubleSide })
    );
    bell.rotation.x = -Math.PI / 2 + 0.26;
    bell.position.set(0, 0.14, 0.53);

    // Exact finger-hole grip targets along the zurna barrel in front of mouth/chest!
    const leftGripNode = new THREE.Object3D();
    leftGripNode.position.set(0.035, 0.20, 0.29);
    const rightGripNode = new THREE.Object3D();
    rightGripNode.position.set(-0.035, 0.17, 0.39);

    zurnaGroup.add(pipe, bell, leftGripNode, rightGripNode);
    chestDecor.add(zurnaGroup);
    root.userData.zurnaNodes = { leftGripNode, rightGripNode };
  }
}

export function createCockroachCharacter(options = {}) {
  const rawOutfit = options.outfit || "plain";
  const modelKey = resolveRoachModelKey(rawOutfit);
  let isBoss = Boolean(options.isHalaybasi || rawOutfit === "halaybasi");
  const instType = options.instrument || (rawOutfit === "davulcu" ? "davul" : rawOutfit === "zurnaci" ? "zurna" : "");

  const root = new THREE.Group();
  const bodyPivot = new THREE.Group();
  root.add(bodyPivot);

  if (modelKey === "sapkali_cocuk") {
    root.scale.setScalar(0.90);
  }

  const glbHolder = new THREE.Group();
  bodyPivot.add(glbHolder);

  // Legacy proxy groups preserved so external callers never throw null-ref errors
  const head = new THREE.Group();
  const leftArm = new THREE.Group();
  leftArm.userData = { elbow: new THREE.Group(), hand: new THREE.Group() };
  const rightArm = new THREE.Group();
  rightArm.userData = { elbow: new THREE.Group(), hand: new THREE.Group() };
  const midLeftArm = new THREE.Group();
  const midRightArm = new THREE.Group();
  const leftLeg = new THREE.Group();
  leftLeg.userData = { knee: new THREE.Group(), foot: new THREE.Group() };
  const rightLeg = new THREE.Group();
  rightLeg.userData = { knee: new THREE.Group(), foot: new THREE.Group() };
  const antennae = [new THREE.Group(), new THREE.Group()];
  const wingGroup = new THREE.Group();

  // Real bone-mounted anchor groups (coordinates in stage metres)
  const headDecor = new THREE.Group();
  const snoutDecor = new THREE.Group();
  const chestDecor = new THREE.Group();
  const hipsDecor = new THREE.Group();
  const rPalmDecor = new THREE.Group();
  const lPalmDecor = new THREE.Group();

  decorateSlimeRoachBones(modelKey, instType, {
    headDecor,
    snoutDecor,
    chestDecor,
    hipsDecor,
    rPalmDecor,
    lPalmDecor,
    root,
  });

  // Temporary handheld gift item (gold coin / $100 bill) shown while walking to pin on Bride/Groom
  const heldGiftGroup = new THREE.Group();
  heldGiftGroup.visible = false;
  const heldCoinMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.058, 0.058, 0.015, 16),
    new THREE.MeshStandardMaterial({ color: 0xfacc15, emissive: 0x854d0e, emissiveIntensity: 0.35, metalness: 0.92, roughness: 0.14 })
  );
  heldCoinMesh.position.y = 0.08;
  const heldCashMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.16, 0.085),
    new THREE.MeshStandardMaterial({ color: 0x16a34a, emissive: 0x052e16, roughness: 0.38, side: THREE.DoubleSide })
  );
  heldCashMesh.position.y = 0.09;
  heldGiftGroup.add(heldCoinMesh, heldCashMesh);
  rPalmDecor.add(heldGiftGroup);

  function setHeldGift(type = null) {
    if (!type) {
      heldGiftGroup.visible = false;
      return;
    }
    heldGiftGroup.visible = true;
    heldCoinMesh.visible = type !== "cash";
    heldCashMesh.visible = type === "cash";
  }

  let mendilPivot = null;
  let mendilClothGroup = null;
  const prevMendilHandWorld = new THREE.Vector3();
  let mendilSeeded = false;
  let mendilSwingX = 0;
  let mendilSwingZ = 0;

  function upgradeToHalaybasi() {
    isBoss = true;
    if (mendilPivot) return;

    const crownGroup = new THREE.Group();
    const ring = new THREE.Mesh(
      new THREE.CylinderGeometry(0.175, 0.145, 0.095, 16),
      new THREE.MeshStandardMaterial({
        color: 0xfacc15,
        emissive: 0xd97706,
        emissiveIntensity: 0.4,
        metalness: 0.85,
        roughness: 0.18,
      })
    );
    ring.position.y = 0.24;
    crownGroup.add(ring);
    headDecor.add(crownGroup);

    // Articulated Multi-Fold Flowing Red Anatolian Halay Mendili
    mendilPivot = new THREE.Group();
    mendilClothGroup = new THREE.Group();
    const clothMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: 0x991b1b,
      emissiveIntensity: 0.42,
      roughness: 0.34,
      side: THREE.DoubleSide,
    });
    const trimMat = new THREE.MeshStandardMaterial({
      color: 0xfde047,
      emissive: 0xca8a04,
      emissiveIntensity: 0.4,
      metalness: 0.85,
      roughness: 0.2,
    });

    // 4-corner handkerchief folds draping from the pinched corner
    for (let f = 0; f < 3; f++) {
      const fold = new THREE.Mesh(new THREE.ConeGeometry(0.11 + f * 0.025, 0.36, 8, 1, true), clothMat);
      fold.position.y = -0.18;
      fold.rotation.y = f * 0.52;
      fold.scale.set(1.15, 1.0, 0.65);
      mendilClothGroup.add(fold);
    }
    // Gold sequin tassels ("pullu oyalı mendil") at bottom hem
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2;
      const spangle = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.006, 8), trimMat);
      spangle.rotation.x = Math.PI / 2;
      spangle.position.set(Math.cos(a) * 0.10, -0.35, Math.sin(a) * 0.07);
      mendilClothGroup.add(spangle);
    }

    mendilPivot.add(mendilClothGroup);
    rPalmDecor.add(mendilPivot);
  }

  function setTeamRibbon(_team) {}

  let coinCount = 0;
  function pinGoldCoin() {
    if (coinCount >= 8) return;
    const coin = new THREE.Mesh(
      new THREE.CylinderGeometry(0.052, 0.052, 0.014, 12),
      new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.9, roughness: 0.15 })
    );
    const row = Math.floor(coinCount / 4);
    const col = (coinCount % 4) - 1.5;
    coin.rotation.x = Math.PI / 2;
    coin.position.set(col * 0.085, 0.08 - row * 0.095, 0.185);
    chestDecor.add(coin);
    coinCount++;
  }

  if (rawOutfit === "halaybasi") upgradeToHalaybasi();

  // Internal Mixamo Skeleton & IK Rig State
  let mixer = null;
  const actions = new Map();
  let activeClipName = "";
  let lastAnimTime = performance.now() * 0.001;
  let blinkAt = 1.5 + Math.random() * 3.0;
  let lid = 0;
  let jaw = 0;
  let mendilSpinPhase = Math.random() * Math.PI * 2;
  const faceParts = { mandibles: [], eyes: [], antennae: [] };
  const faceRestQuats = new Map();

  let skel = null; // Populated once GLB attaches

  function playClip(name, fade = 0.28) {
    if (!mixer || !actions.has(name) || activeClipName === name) return;
    const next = actions.get(name);
    if (!next.isRunning() || next.getEffectiveWeight() < 0.01) next.reset();
    next.enabled = true;
    next.setEffectiveTimeScale(1).setEffectiveWeight(1).play();
    const cur = actions.get(activeClipName);
    if (cur && cur !== next) cur.crossFadeTo(next, fade, false);
    activeClipName = name;
  }

  function buildArmSocket(bonesMap, side, cheerClip, palmHolderGroup) {
    const prefix = `mixamorig${side}`;
    const arm = bonesMap.get(`${prefix}Arm`);
    const fore = bonesMap.get(`${prefix}ForeArm`);
    const hand = bonesMap.get(`${prefix}Hand`);
    const tip = bonesMap.get(`${prefix}HandMiddle1`);
    const fingers = [];
    for (const f of FINGERS) {
      for (const idx of [1, 2, 3]) {
        const fb = bonesMap.get(`${prefix}Hand${f}${idx}`);
        if (fb) fingers.push(fb);
      }
    }
    const grip = new Map();
    if (arm && fore && hand && cheerClip && fingers.length > 0) {
      const saved = fingers.map((b) => b.quaternion.clone());
      for (const bone of fingers) {
        const track = cheerClip.tracks.find((t) => t.name === `${bone.name}.quaternion` || t.name.replace(":", "") === `${bone.name}.quaternion`);
        if (!track) continue;
        const times = track.times;
        let frameIdx = times.findIndex((x) => x >= 0.5 * cheerClip.duration);
        if (frameIdx < 0) frameIdx = 0;
        const v = track.values;
        const q = new THREE.Quaternion(v[frameIdx * 4], v[frameIdx * 4 + 1], v[frameIdx * 4 + 2], v[frameIdx * 4 + 3]);
        grip.set(bone, q);
        bone.quaternion.copy(q);
      }
      hand.updateWorldMatrix(true, true);
      const inv = hand.matrixWorld.clone().invert();
      const atHand = (b) => b.getWorldPosition(new THREE.Vector3()).applyMatrix4(inv);
      const findF = (suffix) => fingers.find((b) => b.name.endsWith(suffix));
      const ix1 = findF("Index1");
      const md1 = findF("Middle1");
      const rg1 = findF("Ring1");
      const pk1 = findF("Pinky1");
      const ix2 = findF("Index2");
      const md2 = findF("Middle2");
      const rg2 = findF("Ring2");
      const pk2 = findF("Pinky2");
      if (ix1 && md1 && rg1 && pk1 && ix2 && md2 && rg2 && pk2) {
        const knuckles = atHand(ix1).add(atHand(md1)).add(atHand(rg1)).add(atHand(pk1)).multiplyScalar(0.25);
        const middles = atHand(ix2).add(atHand(md2)).add(atHand(rg2)).add(atHand(pk2)).multiplyScalar(0.25);
        const up = atHand(ix1).sub(atHand(pk1)).normalize();
        const fwd = knuckles.clone().normalize();
        fwd.addScaledVector(up, -fwd.dot(up)).normalize();
        const palmN = new THREE.Vector3().crossVectors(up, fwd).normalize();
        const centre = knuckles.clone().lerp(middles, 0.5);
        const socketMat = new THREE.Matrix4().makeBasis(palmN, up, fwd).setPosition(centre);
        palmHolderGroup.matrixAutoUpdate = false;
        palmHolderGroup.matrix.copy(socketMat).multiply(new THREE.Matrix4().makeScale(1 / MODEL_SCALE, 1 / MODEL_SCALE, 1 / MODEL_SCALE));
        hand.add(palmHolderGroup);
      }
      fingers.forEach((b, i) => b.quaternion.copy(saved[i]));
    } else if (hand) {
      palmHolderGroup.scale.setScalar(1 / MODEL_SCALE);
      hand.add(palmHolderGroup);
    }

    return {
      arm,
      fore,
      hand,
      tip,
      grip,
      hold(w) {
        if (w <= 0.001) return;
        const cw = Math.min(1, w);
        for (const [bone, q] of grip) {
          bone.quaternion.slerp(q, cw);
        }
        if (hand) hand.updateMatrixWorld(true);
      },
    };
  }

  function attachSlimeRoachInstance(gltf) {
    if (!gltf) return;
    const model = cloneSkinnedScene(gltf.scene);
    model.updateMatrixWorld(true);

    const bones = new Map();
    model.traverse((o) => {
      if (o.isBone) bones.set(o.name.replace(":", ""), o);
    });

    const headBone = bones.get("mixamorigHead");
    const neckBone = bones.get("mixamorigNeck");
    const spineBone = bones.get("mixamorigSpine");
    const spine1Bone = bones.get("mixamorigSpine1");
    const spine2Bone = bones.get("mixamorigSpine2") || spine1Bone;
    const hipsBone = bones.get("mixamorigHips");

    // 1. Attach articulated cockroach face parts (eyes, mandibles, both antennae) in bind pose
    for (const name of ["mandibleL", "mandibleR", "eyeL", "eyeR", "antennaR", "antennaL", "DayiBody"]) {
      const part = model.getObjectByName(name);
      if (!part) continue;
      if (headBone) headBone.attach(part);
      faceRestQuats.set(part, part.quaternion.clone());
      if (name.startsWith("mandible")) faceParts.mandibles.push(part);
      else if (name.startsWith("eye")) faceParts.eyes.push(part);
      else faceParts.antennae.push(part);
    }

    // 2. Attach 3D Wedding Outfits & Role Props in bind pose (+X is forward in model space)
    const bindAttach = (bone, group, x, y, z) => {
      if (!bone) return;
      group.position.set(x, y, z);
      group.rotation.set(0, Math.PI / 2, 0);
      group.scale.setScalar(1 / MODEL_SCALE);
      model.add(group);
      group.updateMatrixWorld(true);
      bone.attach(group);
    };

    bindAttach(headBone, headDecor, 0.048, 0.768, 0);
    bindAttach(headBone, snoutDecor, 0.168, 0.635, 0);
    bindAttach(spine2Bone, chestDecor, 0.048, 0.488, 0);
    bindAttach(hipsBone, hipsDecor, 0.015, 0.355, 0);

    // 3. Align model to face +Z in character root space and scale to stage metres
    const modelAlign = new THREE.Group();
    modelAlign.scale.setScalar(MODEL_SCALE);
    modelAlign.rotation.y = -Math.PI / 2;
    modelAlign.add(model);
    glbHolder.add(modelAlign);
    root.updateMatrixWorld(true);

    // Record head forward axis in head-bone local space from clean bind pose
    let headFwdLocal = null;
    if (headBone) {
      headBone.getWorldQuaternion(_q2);
      root.getWorldQuaternion(_q3);
      const rootFwdWorld = new THREE.Vector3(0, 0, 1).applyQuaternion(_q3);
      headFwdLocal = rootFwdWorld.applyQuaternion(_q2.invert()).normalize();
    }

    // 4. Calibrate fist grip & palm sockets using 'cheer' clip
    const cheerClip = (gltf.animations || []).find((c) => c.name === "cheer");
    const leftArmChain = buildArmSocket(bones, "Left", cheerClip, lPalmDecor);
    const rightArmChain = buildArmSocket(bones, "Right", cheerClip, rPalmDecor);

    // 5. Initialize AnimationMixer on calm 'idle' base clip (NO random club dances!)
    mixer = new THREE.AnimationMixer(model);
    for (const clip of gltf.animations || []) {
      const action = mixer.clipAction(clip);
      actions.set(clip.name, action);
    }
    playClip(actions.has("idle") ? "idle" : (gltf.animations[0]?.name || ""), 0);
    if (mixer) {
      mixer.update(0.1);
      root.updateMatrixWorld(true);
    }

    // Measure neutral standing ankle offsets in root-local space for crisp floor-locked Leg IK
    const invRoot = root.matrixWorld.clone().invert();
    const lFoot = bones.get("mixamorigLeftFoot");
    const rFoot = bones.get("mixamorigRightFoot");
    const lRestRoot = lFoot ? lFoot.getWorldPosition(new THREE.Vector3()).applyMatrix4(invRoot) : new THREE.Vector3(0.27, 0.11, -0.05);
    const rRestRoot = rFoot ? rFoot.getWorldPosition(new THREE.Vector3()).applyMatrix4(invRoot) : new THREE.Vector3(-0.27, 0.11, -0.05);

    skel = {
      model,
      bones,
      hips: hipsBone,
      spine: spineBone,
      spine1: spine1Bone,
      spine2: spine2Bone,
      neck: neckBone,
      head: headBone,
      headFwdLocal,
      hipsBasePos: hipsBone ? hipsBone.position.clone() : new THREE.Vector3(-0.052, 0.364, -0.002),
      leftArm: leftArmChain,
      rightArm: rightArmChain,
      lUpLeg: bones.get("mixamorigLeftUpLeg"),
      lLeg: bones.get("mixamorigLeftLeg"),
      lFoot,
      rUpLeg: bones.get("mixamorigRightUpLeg"),
      rLeg: bones.get("mixamorigRightLeg"),
      rFoot,
      lAnkleRest: lRestRoot,
      rAnkleRest: rRestRoot,
    };
  }

  if (slimeRoachTemplate) {
    attachSlimeRoachInstance(slimeRoachTemplate);
  } else {
    loadSlimeRoachTemplate().then(attachSlimeRoachInstance);
  }

  function _updateFaceAndMendil(dt, now, u, isTalking, energy, mendilSpeed = 1.0) {
    const targetJaw = isTalking ? 0.45 + 0.55 * Math.abs(Math.sin(u * 6.5)) : 0;
    jaw += (targetJaw - jaw) * Math.min(1, dt * 22);
    for (const m of faceParts.mandibles) {
      const rest = faceRestQuats.get(m);
      if (!rest) continue;
      const side = m.name.endsWith("L") ? 1 : -1;
      _q1.setFromAxisAngle(_Y_AXIS, side * jaw * 0.55);
      m.quaternion.copy(rest).multiply(_q1);
    }

    if (now > blinkAt + 0.16) blinkAt = now + 2.2 + Math.random() * 3.0;
    const closed = now > blinkAt && now < blinkAt + 0.16;
    lid += ((closed ? 1 : 0) - lid) * Math.min(1, dt * 35);
    for (const e of faceParts.eyes) {
      const s = isTalking ? 1.06 : 1.0;
      e.scale.set(s, s * Math.max(0.08, 1 - lid), s);
    }

    const antAmp = isTalking ? 0.20 : 0.10 * energy;
    for (let i = 0; i < faceParts.antennae.length; i++) {
      const a = faceParts.antennae[i];
      const rest = faceRestQuats.get(a);
      if (!rest) continue;
      const isLeft = a.name === "DayiBody" || a.name.endsWith("L");
      const side = isLeft ? 1 : -1;
      const ph = u * 1.6 + (side > 0 ? 0 : 1.2);
      _q1.setFromAxisAngle(_Z_AXIS, Math.sin(ph) * antAmp);
      _q2.setFromAxisAngle(_X_AXIS, side * Math.sin(ph * 0.7 + 0.5) * antAmp * 0.8);
      a.quaternion.copy(rest).multiply(_q1).multiply(_q2);
    }

    // Gravity-draped + wrist-whipped Halaybaşı Mendil physics
    if (mendilPivot && mendilClothGroup && mendilPivot.parent) {
      mendilSpinPhase += dt * 7.5 * mendilSpeed;
      mendilPivot.getWorldPosition(_v1);
      if (!mendilSeeded) {
        prevMendilHandWorld.copy(_v1);
        mendilSeeded = true;
      }
      const vx = (_v1.x - prevMendilHandWorld.x) / Math.max(0.008, dt);
      const vz = (_v1.z - prevMendilHandWorld.z) / Math.max(0.008, dt);
      prevMendilHandWorld.copy(_v1);

      const targetSwingX = THREE.MathUtils.clamp(-vz * 0.18 + Math.cos(mendilSpinPhase) * 0.42 * mendilSpeed, -1.05, 1.05);
      const targetSwingZ = THREE.MathUtils.clamp(vx * 0.18 + Math.sin(mendilSpinPhase) * 0.48 * mendilSpeed, -1.05, 1.05);
      const k = Math.min(1, dt * 14);
      mendilSwingX += (targetSwingX - mendilSwingX) * k;
      mendilSwingZ += (targetSwingZ - mendilSwingZ) * k;

      // Orient mendilPivot in world space so -Y always hangs down toward stage floor under gravity!
      if (mendilPivot.parent) {
        mendilPivot.parent.getWorldQuaternion(_q2).invert();
        _q3.setFromEuler(new THREE.Euler(mendilSwingX, mendilSpinPhase * 0.35, mendilSwingZ, "XYZ"));
        mendilPivot.quaternion.copy(_q2.multiply(_q3));
      }
    }
  }

  /**
   * Master Ground-Up Skeletal Choreography & Analytic IK Pose Driver.
   * Replaces all detached dummy rotations and random club dances with exact bone & IK control.
   */
  function poseCharacter(spec = {}) {
    const now = performance.now() * 0.001;
    const dt = Math.min(0.05, Math.max(0.004, now - lastAnimTime));
    lastAnimTime = now;

    const u = spec.u ?? now * 4.0;
    const isTalking = Boolean(spec.isTalking);
    const energy = spec.energy ?? 1.0;

    if (mixer) {
      // Calm 'idle' base clip supplies natural finger relaxation & subtle breathing without fighting IK!
      playClip("idle", 0.3);
      mixer.timeScale = 0.45;
      mixer.update(dt);
    }

    if (!skel) {
      _updateFaceAndMendil(dt, now, u, isTalking, energy, spec.mendilSpeed || 1.0);
      return;
    }

    // Ensure clean wrapper transforms (no double-bounce or glbHolder twist fighting the skeleton)
    glbHolder.rotation.set(0, 0, 0);
    bodyPivot.rotation.set(0, 0, 0);
    bodyPivot.position.set(0, spec.jumpY || 0, 0);
    root.updateMatrixWorld(true);

    // Character basis axes in world space (+X = charLeft, +Y = up, +Z = charFwd)
    root.getWorldQuaternion(_q4);
    const charLeft = new THREE.Vector3(1, 0, 0).applyQuaternion(_q4).normalize();
    const charUp = new THREE.Vector3(0, 1, 0).applyQuaternion(_q4).normalize();
    const charFwd = new THREE.Vector3(0, 0, 1).applyQuaternion(_q4).normalize();
    const rootPos = root.getWorldPosition(new THREE.Vector3());

    // 1. Pelvis (Hips) Local Offset (yaylanma squat, lateral halay shift, forward groove)
    // Remember modelAlign has scale MODEL_SCALE and rotation.y = -PI/2:
    // Model +X = charFwd (+Z), Model +Y = charUp (+Y), Model -Z = charLeft (+X) -> Model +Z = charRight (-X)
    if (skel.hips) {
      const hx = spec.hipSide ?? 0;   // + = character left, - = character right (in stage metres)
      const hy = spec.hipY ?? 0;      // + = up, - = knee-bend squat (in stage metres)
      const hz = spec.hipFwd ?? 0;    // + = forward, - = back (in stage metres)
      skel.hips.position.set(
        skel.hipsBasePos.x + hz / MODEL_SCALE,
        skel.hipsBasePos.y + hy / MODEL_SCALE,
        skel.hipsBasePos.z - hx / MODEL_SCALE
      );
      if (spec.hipYaw || spec.hipRoll) {
        if (spec.hipYaw) {
          _q1.setFromAxisAngle(charUp, spec.hipYaw);
          turnWorld(skel.hips, _q1);
        }
        if (spec.hipRoll) {
          _q1.setFromAxisAngle(charFwd, spec.hipRoll);
          turnWorld(skel.hips, _q1);
        }
      }
      skel.hips.updateMatrixWorld(true);
    }

    // 2. Spine / Torso Lean (Bow), Sway & Twist in World Space
    const spineTarget = skel.spine1 || skel.spine;
    if (spineTarget) {
      if (spec.spineLean) {
        // +spineLean bows chest forward toward charFwd (rotation around charLeft)
        _q1.setFromAxisAngle(charLeft, spec.spineLean * 0.55);
        turnWorld(spineTarget, _q1);
        if (skel.spine2 && skel.spine2 !== spineTarget) {
          _q1.setFromAxisAngle(charLeft, spec.spineLean * 0.45);
          turnWorld(skel.spine2, _q1);
        }
      }
      if (spec.spineSway) {
        _q1.setFromAxisAngle(charFwd, spec.spineSway);
        turnWorld(spineTarget, _q1);
      }
      if (spec.spineTwist) {
        _q1.setFromAxisAngle(charUp, spec.spineTwist);
        turnWorld(skel.spine2 || spineTarget, _q1);
      }
    }

    // 3. Floor-Locked Two-Bone Analytic Leg IK (Knees ALWAYS bend forward along charFwd!)
    if (spec.useLegIK !== false && skel.lUpLeg && skel.rUpLeg) {
      const lf = spec.leftFoot || { side: 0, lift: 0, fwd: 0, pitch: 0 };
      const rf = spec.rightFoot || { side: 0, lift: 0, fwd: 0, pitch: 0 };
      const jumpLift = spec.jumpY || 0;

      // Left Foot World Target
      const lAnkBase = skel.lAnkleRest;
      const lTargetWorld = _v7.copy(rootPos)
        .addScaledVector(charLeft, lAnkBase.x + (lf.side || 0))
        .addScaledVector(charUp, lAnkBase.y + Math.max(0, lf.lift || 0) + jumpLift)
        .addScaledVector(charFwd, lAnkBase.z + (lf.fwd || 0))
        .clone();
      const lPoleWorld = skel.lUpLeg.getWorldPosition(new THREE.Vector3())
        .addScaledVector(charFwd, 1.15)
        .addScaledVector(charLeft, 0.08);
      solveTwoBoneIK(skel.lUpLeg, skel.lLeg, skel.lFoot, lTargetWorld, lPoleWorld, 1.0, true);
      if (lf.pitch && skel.lFoot) {
        // Negative pitch lifts toes up for authentic Halay heel-tap ("topuk vurma")
        _q1.setFromAxisAngle(charLeft, lf.pitch);
        turnWorld(skel.lFoot, _q1);
      }

      // Right Foot World Target
      const rAnkBase = skel.rAnkleRest;
      const rTargetWorld = _v7.copy(rootPos)
        .addScaledVector(charLeft, rAnkBase.x + (rf.side || 0))
        .addScaledVector(charUp, rAnkBase.y + Math.max(0, rf.lift || 0) + jumpLift)
        .addScaledVector(charFwd, rAnkBase.z + (rf.fwd || 0))
        .clone();
      const rPoleWorld = skel.rUpLeg.getWorldPosition(new THREE.Vector3())
        .addScaledVector(charFwd, 1.15)
        .addScaledVector(charLeft, -0.08);
      solveTwoBoneIK(skel.rUpLeg, skel.rLeg, skel.rFoot, rTargetWorld, rPoleWorld, 1.0, true);
      if (rf.pitch && skel.rFoot) {
        _q1.setFromAxisAngle(charLeft, rf.pitch);
        turnWorld(skel.rFoot, _q1);
      }
    }

    // 4. Two-Bone Analytic Arm IK (Neighbor Hand-Linking, Halaybaşı Mendil, Davul, Zurna, Pinning, Waving)
    const resolveHandTarget = (worldVec, localSpec) => {
      if (worldVec) return worldVec;
      if (!localSpec) return null;
      return new THREE.Vector3().copy(rootPos)
        .addScaledVector(charLeft, localSpec.side || 0)
        .addScaledVector(charUp, localSpec.up || 1.0)
        .addScaledVector(charFwd, localSpec.fwd || 0);
    };

    const lHandTarget = resolveHandTarget(spec.leftHandWorld, spec.leftHandLocal);
    if (lHandTarget && skel.leftArm.arm) {
      const lShoulderPos = skel.leftArm.arm.getWorldPosition(new THREE.Vector3());
      const lPole = spec.leftPoleWorld || lShoulderPos.clone()
        .addScaledVector(charLeft, 0.42)
        .addScaledVector(charUp, -0.52)
        .addScaledVector(charFwd, spec.leftElbowFwd ?? -0.18);
      solveTwoBoneIK(skel.leftArm.arm, skel.leftArm.fore, skel.leftArm.hand, lHandTarget, lPole, spec.leftArmWeight ?? 0.96, true);
    }
    if (spec.leftGrip) skel.leftArm.hold(spec.leftGrip);

    const rHandTarget = resolveHandTarget(spec.rightHandWorld, spec.rightHandLocal);
    if (rHandTarget && skel.rightArm.arm) {
      const rShoulderPos = skel.rightArm.arm.getWorldPosition(new THREE.Vector3());
      const rPole = spec.rightPoleWorld || rShoulderPos.clone()
        .addScaledVector(charLeft, -0.42)
        .addScaledVector(charUp, spec.rightElbowUp ?? -0.52)
        .addScaledVector(charFwd, spec.rightElbowFwd ?? -0.18);
      solveTwoBoneIK(skel.rightArm.arm, skel.rightArm.fore, skel.rightArm.hand, rHandTarget, rPole, spec.rightArmWeight ?? 0.96, true);
    }
    if (spec.rightGrip) skel.rightArm.hold(spec.rightGrip);

    // 5. Head Gaze / Nodding
    if (skel.head && skel.headFwdLocal) {
      if (spec.lookAtWorld) {
        skel.head.getWorldQuaternion(_q2);
        const curFwd = _v1.copy(skel.headFwdLocal).applyQuaternion(_q2).normalize();
        const headWorldPos = skel.head.getWorldPosition(_v2);
        const wantDir = _v3.copy(spec.lookAtWorld).sub(headWorldPos);
        if (wantDir.lengthSq() > 1e-4) {
          wantDir.normalize();
          // Clamp extreme neck twist so roaches never owl-spin their heads
          if (wantDir.dot(charFwd) > 0.15) {
            _q1.setFromUnitVectors(curFwd, wantDir);
            _q3.identity().slerp(_q1, spec.lookWeight ?? 0.65);
            turnWorld(skel.head, _q3);
          }
        }
      }
      if (spec.headPitch) {
        _q1.setFromAxisAngle(charLeft, spec.headPitch);
        turnWorld(skel.head, _q1);
      }
      if (spec.headYaw) {
        _q1.setFromAxisAngle(charUp, spec.headYaw);
        turnWorld(skel.head, _q1);
      }
    }

    _updateFaceAndMendil(dt, now, u, isTalking, energy, spec.mendilSpeed || 1.0);
  }

  // Backward-compatible fallback wrapper
  function animatePuppetDeformation(u, isTalking = false, energy = 1.0) {
    poseCharacter({ u, isTalking, energy });
  }

  function getHandWorldPosition(side = "left", out = new THREE.Vector3()) {
    const chain = side === "left" ? skel?.leftArm : skel?.rightArm;
    if (chain?.hand) {
      chain.hand.getWorldPosition(out);
      if (chain.tip) {
        chain.tip.getWorldPosition(_v1);
        out.lerp(_v1, 0.55);
      }
      return out;
    }
    return root.getWorldPosition(out).add(_v1.set(side === "left" ? 0.35 : -0.35, 1.18, 0.15));
  }

  function getShoulderWorldPosition(side = "left", out = new THREE.Vector3()) {
    const chain = side === "left" ? skel?.leftArm : skel?.rightArm;
    if (chain?.arm) return chain.arm.getWorldPosition(out);
    return root.getWorldPosition(out).add(_v1.set(side === "left" ? 0.27 : -0.27, 1.30, 0));
  }

  return {
    root,
    bodyPivot,
    glbHolder,
    head,
    headDecor,
    snoutDecor,
    chestDecor,
    hipsDecor,
    rPalmDecor,
    lPalmDecor,
    wingGroup,
    brows: [],
    palps: [],
    mouthMesh: null,
    antennae,
    leftArm,
    rightArm,
    midLeftArm,
    midRightArm,
    leftLeg,
    rightLeg,
    poseCharacter,
    animatePuppetDeformation,
    getHandWorldPosition,
    getShoulderWorldPosition,
    setHeldGift,
    getMendil: () => mendilPivot,
    isHalaybasi: () => isBoss,
    upgradeToHalaybasi,
    setTeamRibbon,
    pinGoldCoin,
  };
}
