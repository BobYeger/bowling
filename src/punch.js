import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { OutlineEffect } from 'three/addons/effects/OutlineEffect.js';
import { PALETTE, toonMat, noOutline } from './characters/common.js';
import { buildCat } from './characters/cat.js';
import { buildKing } from './characters/king.js';
import { buildQueen } from './characters/queen.js';
import { buildEmperor } from './characters/emperor.js';
import { buildMohawk } from './characters/mohawk.js';

// ---------- The kid's spec ----------
// forest arena, five fighters, everyone punches everyone, space = punch,
// last one standing wins. we are the green cat head.
const ARENA_R = 20;          // where fighters can roam
const WALL_R = 22.5;         // invisible physics fence
const GRAVITY = -22;         // snappy cartoon gravity
const HIT_STUN = 0.38;
const HIT_INVULN = 0.75;
const PUNCH_ARC = 0.25;      // cos of the hit half-angle — generous, ~75°
const AIM_ASSIST = 0.8;      // extra reach when snapping the player toward a target
const STRETCH = 3.9;         // how far the cat's elastic arm extends (× arm length)
const TREE_BONK_SPEED = 7;   // fly this fast into a trunk => extra damage

const FIGHTER_SPECS = [
  // the cat fights with STRETCH punches — his drawing's comically long arms
  // shoot out like elastic and clobber anything in their path
  { key: 'cat',     name: 'החתול הירוק', emoji: '🐱', fall: 'נפל',  hearts: 6, dmg: 1, speed: 7.5, reach: 4.3,  cd: 0.45, density: 1.15, style: 'stretch', build: buildCat },
  { key: 'king',    name: 'המלך',        emoji: '👑', fall: 'נפל',  hearts: 5, dmg: 1, speed: 4.6, reach: 1.7,  cd: 0.95, density: 1.0,  build: buildKing },
  { key: 'queen',   name: 'המלכה',       emoji: '👸', fall: 'נפלה', hearts: 4, dmg: 1, speed: 5.8, reach: 1.65, cd: 1.25, density: 0.95, build: buildQueen },
  { key: 'emperor', name: 'הקיסר',       emoji: '🟣', fall: 'נפל',  hearts: 7, dmg: 2, speed: 3.1, reach: 2.2,  cd: 1.8,  density: 1.1,  build: buildEmperor },
  { key: 'mohawk',  name: 'היצור',       emoji: '⚡', fall: 'נפל',  hearts: 4, dmg: 1, speed: 6.0, reach: 1.5,  cd: 0.65, density: 1.0,  build: buildMohawk },
];
const SPAWNS = { cat: [0, 8], king: [-7, -6], queen: [7, -6], emperor: [0, -11], mohawk: [9.5, 2] };

// ---------- Deterministic hash noise (scenery placement) ----------
let SEED = 20260813;
function rnd(i, j = 0) {
  let h = Math.imul(i + 1, 0x27d4eb2d) ^ Math.imul(j + 13, 0x165667b1) ^ Math.imul(SEED, 0x85ebca77);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// ---------- Renderer / scene ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById('app').appendChild(renderer.domElement);

const INK = new THREE.Color(PALETTE.ink);
const effect = new OutlineEffect(renderer, {
  defaultThickness: 0.0065,
  defaultColor: INK.toArray(),
  defaultKeepAlive: true,
});

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf3efe2);
scene.fog = new THREE.FogExp2(0xf3efe2, 0.02);

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 120);
camera.position.set(0, 9, 18);

scene.add(new THREE.HemisphereLight(0xfff6e0, 0xcfe0c0, 1.25));
const sun = new THREE.DirectionalLight(0xfff2d9, 1.0);
sun.position.set(6, 14, 5);
scene.add(sun);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------- Forest floor ----------
const ground = new THREE.Mesh(
  new THREE.CircleGeometry(30, 40).rotateX(-Math.PI / 2),
  noOutline(toonMat(0xe9eeda))
);
scene.add(ground);
for (let i = 0; i < 26; i++) {
  const r = 2 + rnd(i, 1) * 24;
  const a = rnd(i, 2) * Math.PI * 2;
  const patch = new THREE.Mesh(
    new THREE.CircleGeometry(0.8 + rnd(i, 3) * 2.2, 9).rotateX(-Math.PI / 2),
    noOutline(toonMat(i % 2 ? 0xdfe7cc : 0xe2e9d2))
  );
  patch.position.set(Math.cos(a) * r, 0.012 + i * 0.0004, Math.sin(a) * r);
  patch.rotation.y = rnd(i, 4) * Math.PI;
  patch.scale.x = 0.7 + rnd(i, 5) * 0.7;
  scene.add(patch);
}

// ---------- Swaying grass (the signature shader — marker strokes in the wind) ----------
const uTime = { value: 0 };
const GRASS_N = 320;
{
  const blade = new THREE.ConeGeometry(0.055, 0.42, 5);
  blade.translate(0, 0.21, 0);
  const grassMat = noOutline(toonMat(PALETTE.grassGreen));
  grassMat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uTime;
    sh.vertexShader = ('uniform float uTime;\n' + sh.vertexShader).replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      #ifdef USE_INSTANCING
        float ph = float(gl_InstanceID) * 1.73;
        transformed.x += sin(uTime * 2.1 + ph) * transformed.y * 0.38;
        transformed.z += cos(uTime * 1.7 + ph * 1.3) * transformed.y * 0.22;
      #endif`
    );
  };
  const grass = new THREE.InstancedMesh(blade, grassMat, GRASS_N);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  const c = new THREE.Color();
  for (let i = 0; i < GRASS_N; i++) {
    const cluster = Math.floor(i / 3);
    const r = 2.5 + rnd(cluster, 10) * 20.5;
    const a = rnd(cluster, 11) * Math.PI * 2;
    const x = Math.cos(a) * r + (rnd(i, 12) - 0.5) * 0.5;
    const z = Math.sin(a) * r + (rnd(i, 13) - 0.5) * 0.5;
    e.set((rnd(i, 14) - 0.5) * 0.35, rnd(i, 15) * Math.PI, (rnd(i, 16) - 0.5) * 0.35);
    q.setFromEuler(e);
    m.compose(new THREE.Vector3(x, 0, z), q, new THREE.Vector3(1, 0.7 + rnd(i, 17) * 0.9, 1));
    grass.setMatrixAt(i, m);
    grass.setColorAt(i, c.setHex(i % 3 === 0 ? 0x2e8b3e : i % 3 === 1 ? 0x4ea24e : 0x62b04f));
  }
  scene.add(grass);
}

// ---------- Trees (instanced, shakeable) ----------
const trees = [];             // { x, z, shake } — interior trees get colliders + bonks
const treeParts = [];         // instanced meshes to wobble on shake
{
  const positions = [];
  // interior trees, keeping clearings around spawn points
  let attempts = 0, placed = 0;
  while (placed < 24 && attempts < 400) {
    attempts++;
    const r = 5 + rnd(attempts, 20) * 14;
    const a = rnd(attempts, 21) * Math.PI * 2;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (positions.some(p => (p.x - x) ** 2 + (p.z - z) ** 2 < 3.6 ** 2)) continue;
    if (Object.values(SPAWNS).some(([sx, sz]) => (sx - x) ** 2 + (sz - z) ** 2 < 3.2 ** 2)) continue;
    positions.push({ x, z, interior: true });
    placed++;
  }
  // the forest wall ring (visual, behind the fence)
  for (let i = 0; i < 34; i++) {
    const a = (i / 34) * Math.PI * 2 + rnd(i, 22) * 0.12;
    const r = 23.5 + rnd(i, 23) * 2.5;
    positions.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, interior: false });
  }

  const trunkGeo = new THREE.CylinderGeometry(0.3, 0.46, 3.4, 7);
  trunkGeo.translate(0, 1.7, 0);
  const canopyGeo = new THREE.IcosahedronGeometry(1.5, 1);
  const trunkMesh = new THREE.InstancedMesh(trunkGeo, toonMat(0x8a5a34), positions.length);
  const canopyMesh = new THREE.InstancedMesh(canopyGeo, toonMat(0x4ea24e), positions.length);
  const topMesh = new THREE.InstancedMesh(canopyGeo, toonMat(0x62b04f), positions.length);
  const m = new THREE.Matrix4(), c = new THREE.Color();
  const canopyColors = [0x3e9e4f, 0x4ea24e, 0x2e8b3e, 0x5cb85f];
  positions.forEach((p, i) => {
    const s = 0.85 + rnd(i, 24) * 0.5;
    // remember each tree's canopy quirks so shake/duck can rebuild its matrices
    const a1 = 1 + rnd(i, 25) * 0.3, a2 = 0.9 + rnd(i, 26) * 0.3;
    const bx = (rnd(i, 27) - 0.5) * 0.6;
    trees.push({ x: p.x, z: p.z, s, a1, a2, bx, shake: 0, duck: 0, want: 0, interior: p.interior });
    m.makeScale(s, s, s).setPosition(p.x, 0, p.z);
    trunkMesh.setMatrixAt(i, m);
    m.makeScale(s * a1, s * a2, s).setPosition(p.x, 3.6 * s, p.z);
    canopyMesh.setMatrixAt(i, m);
    canopyMesh.setColorAt(i, c.setHex(canopyColors[i % 4]));
    m.makeScale(s * 0.62, s * 0.6, s * 0.62).setPosition(p.x + bx, 4.7 * s, p.z);
    topMesh.setMatrixAt(i, m);
    topMesh.setColorAt(i, c.setHex(canopyColors[(i + 2) % 4]));
  });
  treeParts.push(trunkMesh, canopyMesh, topMesh);
  scene.add(trunkMesh, canopyMesh, topMesh);
}
function shakeTree(idx) {
  trees[idx].shake = 0.7;
  for (let k = 0; k < 5; k++) spawnLeaf(trees[idx].x, 3.4 * trees[idx].s, trees[idx].z);
}
// Trees shake when someone is knocked into them — and DUCK (squash their
// canopy down) when they'd block the camera's view of any fighter, so the
// action never hides behind a treetop.
const _tm = new THREE.Matrix4(), _tq = new THREE.Quaternion(), _te = new THREE.Euler();
const _tv = new THREE.Vector3();
function updateTrees(dt) {
  // which trees sit between the camera and someone alive?
  const cx = camera.position.x, cz = camera.position.z;
  for (const t of trees) t.want = 0;
  for (const f of fighters) {
    if (f.removed) continue;
    const p = f.body.translation();
    const ax = p.x - cx, az = p.z - cz;
    const len2 = ax * ax + az * az || 1;
    for (const t of trees) {
      if (t.want) continue;
      const k = ((t.x - cx) * ax + (t.z - cz) * az) / len2;
      if (k < 0.15 || k > 0.96) continue;
      const px = cx + ax * k - t.x, pz = cz + az * k - t.z;
      const r = 2.0 * t.s;
      if (px * px + pz * pz < r * r) t.want = 1;
    }
  }

  let dirty = false;
  trees.forEach((t, i) => {
    const before = t.duck;
    t.duck += (t.want - t.duck) * Math.min(1, dt * 5);
    if (t.duck < 0.004 && !t.want) t.duck = 0;
    if (t.shake > 0) t.shake = Math.max(0, t.shake - dt);
    if (t.shake <= 0 && t.duck === 0 && before === 0) return;
    dirty = true;

    const w = t.shake > 0 ? Math.sin(uTime.value * 34 + i) * 0.05 * t.shake : 0;
    _te.set(w, 0, w * 0.8); _tq.setFromEuler(_te);
    const d = t.duck, s = t.s;
    _tm.compose(_tv.set(t.x, 0, t.z), _tq, new THREE.Vector3(s, s, s));
    treeParts[0].setMatrixAt(i, _tm);
    _tm.compose(
      _tv.set(t.x, (3.6 - 2.0 * d) * s, t.z), _tq,
      new THREE.Vector3(s * t.a1 * (1 - 0.2 * d), s * t.a2 * (1 - 0.72 * d), s * (1 - 0.2 * d)),
    );
    treeParts[1].setMatrixAt(i, _tm);
    _tm.compose(
      _tv.set(t.x + t.bx, (4.7 - 3.0 * d) * s, t.z), _tq,
      new THREE.Vector3(s * 0.62 * (1 - 0.25 * d), s * 0.6 * (1 - 0.78 * d), s * 0.62 * (1 - 0.25 * d)),
    );
    treeParts[2].setMatrixAt(i, _tm);
  });
  if (dirty) treeParts.forEach(p => (p.instanceMatrix.needsUpdate = true));
}

// ---------- Physics ----------
let world = null;
function setupPhysics() {
  world = new RAPIER.World({ x: 0, y: GRAVITY, z: 0 });
  world.createCollider(RAPIER.ColliderDesc.cuboid(40, 0.5, 40).setTranslation(0, -0.5, 0).setFriction(0.6));
  // fence
  const segs = 16;
  for (let i = 0; i < segs; i++) {
    const a = (i / segs) * Math.PI * 2;
    const half = WALL_R * Math.tan(Math.PI / segs) + 0.6;
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -a, 0));
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(half, 4, 0.4)
        .setTranslation(Math.cos(a) * WALL_R, 4, Math.sin(a) * WALL_R)
        .setRotation({ x: q.x, y: q.y, z: q.z, w: q.w })
    );
  }
  // interior trunks
  trees.forEach(t => {
    if (!t.interior) return;
    world.createCollider(RAPIER.ColliderDesc.cylinder(1.9, 0.42 * t.s).setTranslation(t.x, 1.9, t.z));
  });
}

// ---------- FX pools ----------
function starTexture() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const ctx = cv.getContext('2d');
  ctx.translate(64, 64);
  ctx.beginPath();
  for (let i = 0; i < 16; i++) {
    const r = i % 2 ? 22 : 56;
    const a = (i / 16) * Math.PI * 2;
    ctx[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fillStyle = '#fff9d9';
  ctx.strokeStyle = '#2a2118';
  ctx.lineWidth = 7;
  ctx.fill(); ctx.stroke();
  const tex = new THREE.CanvasTexture(cv);
  return tex;
}
const starTex = starTexture();
const stars = [];
for (let i = 0; i < 10; i++) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: starTex, transparent: true, depthWrite: false }));
  s.visible = false;
  scene.add(s);
  stars.push({ s, life: 0 });
}
function spawnStar(pos, big = false) {
  const st = stars.find(x => x.life <= 0); if (!st) return;
  st.life = 0.28;
  st.big = big;
  st.s.position.copy(pos);
  st.s.material.rotation = Math.random() * Math.PI;
  st.s.visible = true;
}

const arcs = [];
{
  const geo = new THREE.RingGeometry(0.55, 0.8, 14, 1, 0, 2.0);
  for (let i = 0; i < 8; i++) {
    const mesh = new THREE.Mesh(geo, noOutline(new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false,
    })));
    mesh.visible = false;
    scene.add(mesh);
    arcs.push({ mesh, life: 0 });
  }
}
function spawnArc(pos, yaw) {
  const a = arcs.find(x => x.life <= 0); if (!a) return;
  a.life = 0.16;
  a.mesh.position.copy(pos);
  a.mesh.rotation.order = 'YXZ';
  a.mesh.rotation.set(-Math.PI / 2.6, yaw, -1.0);
  a.mesh.visible = true;
}

const leaves = [];
{
  const geo = new THREE.CircleGeometry(0.11, 3);
  for (let i = 0; i < 40; i++) {
    const mesh = new THREE.Mesh(geo, noOutline(new THREE.MeshBasicMaterial({
      color: i % 2 ? 0x4ea24e : 0x2e8b3e, transparent: true, side: THREE.DoubleSide, depthWrite: false,
    })));
    mesh.visible = false;
    scene.add(mesh);
    leaves.push({ mesh, life: 0, vx: 0, vy: 0, vz: 0 });
  }
}
function spawnLeaf(x, y, z) {
  const l = leaves.find(v => v.life <= 0); if (!l) return;
  l.life = 1.1 + Math.random() * 0.5;
  l.mesh.position.set(x + (Math.random() - 0.5) * 1.6, y + Math.random() * 1.2, z + (Math.random() - 0.5) * 1.6);
  l.vx = (Math.random() - 0.5) * 1.4; l.vy = -1.6 - Math.random(); l.vz = (Math.random() - 0.5) * 1.4;
  l.mesh.visible = true;
}

const poofTex = (() => {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 96;
  const ctx = cv.getContext('2d');
  ctx.beginPath(); ctx.arc(48, 48, 34, 0, Math.PI * 2);
  ctx.fillStyle = '#f6f1e4'; ctx.strokeStyle = '#2a2118'; ctx.lineWidth = 5;
  ctx.fill(); ctx.stroke();
  return new THREE.CanvasTexture(cv);
})();
const poofs = [];
for (let i = 0; i < 18; i++) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: poofTex, transparent: true, depthWrite: false }));
  s.visible = false;
  scene.add(s);
  poofs.push({ s, life: 0, vx: 0, vy: 0, vz: 0 });
}
function spawnPoof(pos, n = 6) {
  for (let k = 0; k < n; k++) {
    const p = poofs.find(x => x.life <= 0); if (!p) return;
    p.life = 0.55;
    p.s.position.copy(pos);
    const a = (k / n) * Math.PI * 2;
    p.vx = Math.cos(a) * 2.4; p.vy = 1.5 + Math.random(); p.vz = Math.sin(a) * 2.4;
    p.s.visible = true;
  }
}
function updateFX(dt) {
  stars.forEach(st => {
    if (st.life <= 0) return;
    st.life -= dt;
    const k = 1 - st.life / 0.28;
    st.s.scale.setScalar((st.big ? 2.2 : 1.4) * (0.5 + k * 1.2));
    st.s.material.opacity = 1 - k;
    if (st.life <= 0) st.s.visible = false;
  });
  arcs.forEach(a => {
    if (a.life <= 0) return;
    a.life -= dt;
    const k = 1 - a.life / 0.16;
    a.mesh.scale.setScalar(0.7 + k * 1.1);
    a.mesh.material.opacity = 0.9 * (1 - k);
    if (a.life <= 0) a.mesh.visible = false;
  });
  leaves.forEach(l => {
    if (l.life <= 0) return;
    l.life -= dt;
    l.mesh.position.x += (l.vx + Math.sin(l.life * 9)) * dt;
    l.mesh.position.y += l.vy * dt;
    l.mesh.position.z += l.vz * dt;
    l.mesh.rotation.x += dt * 5; l.mesh.rotation.y += dt * 7;
    l.mesh.material.opacity = Math.min(1, l.life);
    if (l.life <= 0 || l.mesh.position.y < 0.05) { l.life = 0; l.mesh.visible = false; }
  });
  poofs.forEach(p => {
    if (p.life <= 0) return;
    p.life -= dt;
    const k = 1 - p.life / 0.55;
    p.s.position.x += p.vx * dt; p.s.position.y += p.vy * dt; p.s.position.z += p.vz * dt;
    p.s.scale.setScalar(0.5 + k * 1.6);
    p.s.material.opacity = 0.95 * (1 - k);
    if (p.life <= 0) p.s.visible = false;
  });
}

// ---------- Audio ----------
let audioCtx = null;
function beep(freq, t0, dur, type = 'square', vol = 0.12, slideTo = 0) {
  if (!audioCtx) return;
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, audioCtx.currentTime + t0);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, audioCtx.currentTime + t0 + dur);
  g.gain.setValueAtTime(vol, audioCtx.currentTime + t0);
  g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + t0 + dur);
  o.connect(g).connect(audioCtx.destination);
  o.start(audioCtx.currentTime + t0);
  o.stop(audioCtx.currentTime + t0 + dur + 0.05);
}
function noiseBurst(dur, freq, vol, t0 = 0) {
  if (!audioCtx) return;
  const len = Math.floor(audioCtx.sampleRate * dur);
  const buf = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = audioCtx.createBufferSource();
  src.buffer = buf;
  const filter = audioCtx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = freq;
  const g = audioCtx.createGain();
  g.gain.value = vol;
  src.connect(filter).connect(g).connect(audioCtx.destination);
  src.start(audioCtx.currentTime + t0);
}
const whooshSound = () => { noiseBurst(0.09, 1600, 0.09); beep(320, 0, 0.05, 'triangle', 0.05, 190); };
const boingSound = () => { beep(190, 0, 0.16, 'triangle', 0.13, 820); noiseBurst(0.07, 1900, 0.05); };
const thudSound = () => { beep(130, 0, 0.09, 'square', 0.18); beep(72, 0.03, 0.12, 'square', 0.15); noiseBurst(0.1, 420, 0.16); };
const bonkSound = () => { beep(95, 0, 0.16, 'square', 0.2, 58); noiseBurst(0.14, 260, 0.2); };
const koSound = () => { [430, 300, 200, 120].forEach((f, i) => beep(f, i * 0.09, 0.13, 'sawtooth', 0.13)); noiseBurst(0.4, 500, 0.12, 0.1); };
const winSound = () => { [392, 494, 587, 784, 988].forEach((f, i) => beep(f, i * 0.13, 0.22, 'triangle', 0.14)); };
const loseSound = () => { [330, 262, 208, 156].forEach((f, i) => beep(f, i * 0.16, 0.3, 'sawtooth', 0.11)); };
const startSound = () => { beep(660, 0, 0.09, 'square', 0.12); beep(880, 0.12, 0.14, 'square', 0.12); };

// ---------- HUD ----------
const fightersEl = document.getElementById('fighters');
const msgEl = document.getElementById('msg');
let msgTimer = null;
function announce(text, good = false) {
  msgEl.textContent = text;
  msgEl.classList.toggle('good', good);
  msgEl.classList.add('show');
  clearTimeout(msgTimer);
  msgTimer = setTimeout(() => msgEl.classList.remove('show'), 1500);
}

// ---------- Fighters ----------
const fighters = [];
const V3 = new THREE.Vector3();

function makeFighter(spec) {
  const built = spec.build();
  const capTotal = Math.max(1.0, built.height * 0.82);
  const capR = Math.min(built.radius * 0.8, capTotal * 0.32);
  const cylHalf = Math.max(0.05, capTotal / 2 - capR);
  const centerY = capTotal / 2;

  const pivot = new THREE.Group();          // physics-driven node (origin = capsule center)
  built.group.position.y = -centerY;
  pivot.add(built.group);
  scene.add(pivot);

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(built.radius * 0.85, 18).rotateX(-Math.PI / 2),
    noOutline(new THREE.MeshBasicMaterial({ color: 0x2a2118, transparent: true, opacity: 0.14, depthWrite: false }))
  );
  scene.add(shadow);

  const [sx, sz] = SPAWNS[spec.key];
  const body = world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(sx, centerY + 0.05, sz)
      .lockRotations()
      .setLinearDamping(1.0)
      .setCcdEnabled(true)
  );
  const collider = world.createCollider(
    RAPIER.ColliderDesc.capsule(cylHalf, capR).setDensity(spec.density).setFriction(0.25).setRestitution(0.2),
    body
  );

  // HUD card
  const card = document.createElement('div');
  card.className = 'card' + (spec.key === 'cat' ? ' me' : '');
  card.innerHTML = `<div>${spec.emoji} ${spec.name}</div><div class="hearts"></div>`;
  fightersEl.appendChild(card);

  const f = {
    spec, built, pivot, shadow, body, collider, centerY,
    hearts: spec.hearts, alive: true, removed: false,
    yaw: Math.atan2(-sx, -sz),
    hitstun: 0, invuln: 0, punchCd: 0,
    punch: null,            // { t, arm } while punching
    lastHitBy: null, koTimer: 0,
    ai: { target: null, think: rnd(spec.key.length, 40) * 0.5, retreat: 0, dashUntil: 0 },
    card,
  };
  f.isPlayer = spec.key === 'cat';
  updateCard(f);
  return f;
}

function updateCard(f) {
  const el = f.card.querySelector('.hearts');
  el.textContent = '❤️'.repeat(Math.max(0, f.hearts)) + '🤍'.repeat(f.spec.hearts - Math.max(0, f.hearts));
  if (!f.alive) f.card.classList.add('dead');
  else {
    f.card.classList.add('hit');
    setTimeout(() => f.card.classList.remove('hit'), 140);
  }
}

// ---------- Combat ----------
let shake = 0;

function startPunch(f) {
  if (!f.alive || f.punch || f.punchCd > 0 || f.hitstun > 0) return;

  // aim assist: the player's punch snaps toward the nearest fighter in
  // range, so standing your ground and mashing space actually connects.
  if (f.isPlayer) {
    const p = f.body.translation();
    let best = null, bestD = Infinity;
    for (const v of fighters) {
      if (v === f || !v.alive) continue;
      const vp = v.body.translation();
      const d = Math.hypot(vp.x - p.x, vp.z - p.z);
      if (d < f.spec.reach + v.built.radius + AIM_ASSIST && d < bestD) { bestD = d; best = v; }
    }
    if (best) {
      const vp = best.body.translation();
      f.yaw = f.targetYaw = Math.atan2(vp.x - p.x, vp.z - p.z);
    }
  }

  f.punch = { t: 0, arm: (f.punchArmToggle = !f.punchArmToggle) ? 'right' : 'left', hit: false };
  f.punchCd = f.spec.cd;
  if (f.spec.style === 'stretch') boingSound();
  else whooshSound();
  // little lunge
  const dir = V3.set(Math.sin(f.yaw), 0, Math.cos(f.yaw));
  f.body.applyImpulse({ x: dir.x * 1.4 * f.body.mass(), y: 0, z: dir.z * 1.4 * f.body.mass() }, true);
}

function resolvePunchHit(f, quiet = false) {
  const myPos = f.body.translation();
  const dir = V3.set(Math.sin(f.yaw), 0, Math.cos(f.yaw)).clone();
  const stretch = f.spec.style === 'stretch';
  if (!quiet) {
    const arcD = stretch ? f.spec.reach * 0.5 : 0.7;
    spawnArc(new THREE.Vector3(myPos.x + dir.x * arcD, myPos.y + 0.15, myPos.z + dir.z * arcD), f.yaw);
  }

  let landed = 0;
  for (const v of fighters) {
    if (v === f || !v.alive || v.invuln > 0) continue;
    const vp = v.body.translation();
    const dx = vp.x - myPos.x, dz = vp.z - myPos.z;
    const dist = Math.hypot(dx, dz);
    if (dist > f.spec.reach + v.built.radius) continue;
    if (stretch) {
      // the elastic arm is a corridor: clobber everything along its line
      const along = dx * dir.x + dz * dir.z;
      if (along < 0.2) continue;
      const perp = Math.abs(dx * dir.z - dz * dir.x);
      if (perp > 1.05 + v.built.radius * 0.5) continue;
    } else {
      const dot = (dx * dir.x + dz * dir.z) / (dist || 1);
      if (dot < PUNCH_ARC) continue;
    }
    hitFighter(v, f, dir, 1.0);
    landed++;
  }
  return landed;
}

function hitFighter(v, attacker, dir, power) {
  const dmg = attacker.spec.dmg;
  v.hearts -= dmg;
  v.hitstun = HIT_STUN;
  v.invuln = HIT_INVULN;
  v.lastHitBy = attacker;
  updateCard(v);

  const taken = v.spec.hearts - v.hearts;
  const k = (6.2 + taken * 1.15) * power * (attacker.spec.key === 'emperor' ? 1.5 : 1);
  const m = v.body.mass();
  v.body.applyImpulse({ x: dir.x * k * m, y: 4.6 * m * power, z: dir.z * k * m }, true);

  const vp = v.body.translation();
  spawnStar(new THREE.Vector3(vp.x, vp.y + v.centerY * 0.6, vp.z), dmg > 1);
  thudSound();
  shake = Math.min(0.5, shake + (v.isPlayer ? 0.3 : 0.16) + dmg * 0.05);

  if (v.hearts <= 0) koFighter(v, attacker, dir);
}

function koFighter(v, attacker, dir) {
  v.alive = false;
  v.koTimer = 2.2;
  updateCard(v);
  koSound();
  // bake yaw into the body, then let it tumble
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, v.yaw, 0));
  v.body.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }, true);
  v.body.setEnabledRotations(true, true, true, true);
  const m = v.body.mass();
  v.body.applyImpulse({ x: dir.x * 9 * m, y: 7.5 * m, z: dir.z * 9 * m }, true);
  v.body.applyTorqueImpulse({ x: dir.z * 3.5 * m, y: (rnd(v.spec.key.length, 50) - 0.5) * 2 * m, z: -dir.x * 3.5 * m }, true);
  announce(`${v.spec.emoji} ${v.spec.name} ${v.spec.fall}!`, !v.isPlayer);

  if (v.isPlayer) {
    setTimeout(() => endGame(false, attacker), 1400);
  } else if (fighters.every(x => x.isPlayer || !x.alive)) {
    setTimeout(() => endGame(true, null), 900);
  }
}

// flying into a trunk hurts
function checkTreeBonks() {
  for (const f of fighters) {
    if (!f.alive || f.hitstun <= 0) continue;
    const vel = f.body.linvel();
    const speed = Math.hypot(vel.x, vel.z);
    if (speed < TREE_BONK_SPEED) continue;
    const p = f.body.translation();
    for (let i = 0; i < trees.length; i++) {
      const t = trees[i];
      if (!t.interior) continue;
      const d = Math.hypot(t.x - p.x, t.z - p.z);
      if (d < 0.45 * t.s + f.built.radius * 0.8 + 0.15) {
        f.hearts -= 1;
        f.invuln = Math.max(f.invuln, 0.4);
        updateCard(f);
        shakeTree(i);
        bonkSound();
        shake = Math.min(0.5, shake + 0.22);
        spawnStar(new THREE.Vector3(p.x, p.y + 0.4, p.z), false);
        if (f.hearts <= 0 && f.alive) {
          const dir = V3.set(p.x - t.x, 0, p.z - t.z).normalize().clone();
          koFighter(f, f.lastHitBy || f, dir);
        }
        break;
      }
    }
  }
}

// ---------- AI ----------
function aiTick(f, dt, t) {
  const ai = f.ai;
  ai.think -= dt;
  const alive = fighters.filter(x => x.alive && x !== f);
  if (!alive.length) return { mx: 0, mz: 0, punch: false };

  if (ai.think <= 0 || !ai.target || !ai.target.alive) {
    ai.think = f.spec.key === 'mohawk' ? 1.2 : 2.2;
    if (f.spec.key === 'king') {
      ai.target = alive.reduce((a, b) => distTo(f, a) < distTo(f, b) ? a : b);
    } else if (f.spec.key === 'queen') {
      ai.target = alive.reduce((a, b) => (a.hearts < b.hearts || (a.hearts === b.hearts && distTo(f, a) < distTo(f, b))) ? a : b);
    } else if (f.spec.key === 'emperor') {
      ai.target = (f.lastHitBy && f.lastHitBy.alive) ? f.lastHitBy : alive.reduce((a, b) => distTo(f, a) < distTo(f, b) ? a : b);
    } else {
      ai.target = alive[Math.floor(rnd(Math.floor(t * 10), f.spec.key.length) * alive.length) % alive.length];
    }
  }
  const target = ai.target;
  const p = f.body.translation();
  const tp = target.body.translation();
  let dx = tp.x - p.x, dz = tp.z - p.z;
  const dist = Math.hypot(dx, dz) || 1;
  dx /= dist; dz /= dist;

  const inRange = dist < f.spec.reach + target.built.radius * 0.9;
  let mx = dx, mz = dz, wantPunch = false;

  if (f.spec.key === 'queen') {
    if (ai.retreat > 0) { ai.retreat -= dt; mx = -dx; mz = -dz; }
    else if (f.punchCd <= 0 || dist < 3.5) { /* dash in */ }
    else { mx = dz * 0.8 - dx * 0.2; mz = -dx * 0.8 - dz * 0.2; } // circle while waiting
    if (inRange && f.punchCd <= 0) { wantPunch = true; ai.retreat = 1.1; }
  } else if (f.spec.key === 'mohawk') {
    const zig = Math.sin(t * 3.6 + 1.7);
    mx = dx + dz * zig * 0.9; mz = dz - dx * zig * 0.9;
    wantPunch = inRange && f.punchCd <= 0;
  } else if (f.spec.key === 'emperor') {
    wantPunch = inRange && f.punchCd <= 0;
  } else { // king
    const circ = Math.sin(t * 1.3) * 0.35;
    mx = dx + dz * circ; mz = dz - dx * circ;
    wantPunch = inRange && f.punchCd <= 0;
  }

  if (inRange) { mx *= 0.15; mz *= 0.15; }

  // stay off the fence
  const r = Math.hypot(p.x, p.z);
  if (r > ARENA_R) { mx -= (p.x / r) * 1.2; mz -= (p.z / r) * 1.2; }

  // face the target when close, else face movement
  f.targetYaw = dist < 4.5 ? Math.atan2(dx, dz) : Math.atan2(mx, mz);
  return { mx, mz, punch: wantPunch };
}
function distTo(a, b) {
  const pa = a.body.translation(), pb = b.body.translation();
  return Math.hypot(pb.x - pa.x, pb.z - pa.z);
}

// ---------- Input ----------
const keys = {};
let state = 'intro'; // intro | play | over
window.addEventListener('keydown', (e) => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(e.code)) e.preventDefault();
  keys[e.code] = true;
  if (e.code === 'Space' && state === 'play') {
    const me = fighters[0];
    startPunch(me);
  }
});
window.addEventListener('keyup', (e) => (keys[e.code] = false));

// ---------- Game flow ----------
function endGame(won, attacker) {
  if (state === 'over') return;
  state = 'over';
  document.getElementById('hint').classList.add('hidden');
  const overlay = document.getElementById('gameover');
  const title = document.getElementById('goTitle');
  const detail = document.getElementById('goDetail');
  if (won) {
    winSound();
    title.textContent = '🏆 ניצחתם! החתול אחרון ביער!';
    detail.textContent = 'כל הכבוד! הפלתם את המלך, המלכה, הקיסר והיצור! 🥊';
  } else {
    loseSound();
    const left = fighters.filter(x => x.alive).length;
    title.textContent = '💥 נפלתם!';
    detail.textContent = `${attacker ? attacker.spec.emoji + ' ' + attacker.spec.name + ' הפיל אתכם' : 'הפסדתם'} · נשארו ${left} לוחמים ביער`;
  }
  overlay.classList.remove('hidden');
}
document.getElementById('restartBtn').addEventListener('click', () => location.reload());
document.getElementById('startBtn').addEventListener('click', () => {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  audioCtx.resume && audioCtx.resume();
  document.getElementById('intro').classList.add('hidden');
  document.getElementById('hint').classList.remove('hidden');
  state = 'play';
  startSound();
  announce('🥊 פייט!', true);
});

// ---------- Per-frame fighter update ----------
function updateFighter(f, dt, t) {
  if (f.removed) return;

  // timers
  f.punchCd = Math.max(0, f.punchCd - dt);
  f.hitstun = Math.max(0, f.hitstun - dt);
  f.invuln = Math.max(0, f.invuln - dt);

  const p = f.body.translation();

  if (f.alive) {
    // control — but while in hitstun the punch impulse owns the body (flying!)
    if (f.hitstun <= 0) {
      let mx = 0, mz = 0, wantPunch = false;
      if (state === 'play') {
        if (f.isPlayer) {
          mx = (keys.ArrowRight || keys.KeyD ? 1 : 0) - (keys.ArrowLeft || keys.KeyA ? 1 : 0);
          mz = (keys.ArrowDown || keys.KeyS ? 1 : 0) - (keys.ArrowUp || keys.KeyW ? 1 : 0);
          const len = Math.hypot(mx, mz) || 1;
          mx /= len; mz /= len;
          if (mx || mz) f.targetYaw = Math.atan2(mx, mz);
        } else {
          const cmd = aiTick(f, dt, t);
          mx = cmd.mx; mz = cmd.mz;
          wantPunch = cmd.punch;
        }
      }
      // velocity control (keep gravity's y)
      const vel = f.body.linvel();
      const sp = f.spec.speed * (f.punch ? 0.35 : 1);
      f.body.setLinvel({ x: mx * sp, y: vel.y, z: mz * sp }, true);
      if (wantPunch) startPunch(f);
    }

    // smooth facing
    if (f.targetYaw !== undefined) {
      let d = f.targetYaw - f.yaw;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      f.yaw += d * Math.min(1, dt * 10);
    }
    f.pivot.position.set(p.x, p.y, p.z);
    f.pivot.rotation.set(0, f.yaw, 0);
  } else {
    // tumbling KO ragdoll
    f.pivot.position.set(p.x, p.y, p.z);
    const q = f.body.rotation();
    f.pivot.quaternion.set(q.x, q.y, q.z, q.w);
    f.koTimer -= dt;
    if (f.koTimer <= 0) {
      spawnPoof(new THREE.Vector3(p.x, p.y, p.z), 7);
      world.removeRigidBody(f.body);
      f.pivot.visible = false;
      f.shadow.visible = false;
      f.removed = true;
      return;
    }
  }

  // punch animation
  if (f.punch) {
    f.punch.t += dt;
    const pt = f.punch.t;
    const arm = f.built.arms[f.punch.arm];

    if (f.spec.style === 'stretch') {
      // ---- the cat's elastic arm: aim, SHOOT out ~4 units, snap back ----
      const side = f.punch.arm === 'right' ? 1 : -1;     // assembly side (±X)
      const aimRot = -side * Math.PI / 2;                // swing ±X exactly to +Z
      if (arm && arm.pivot && arm.arm) {
        if (arm.fistRestX === undefined) arm.fistRestX = arm.fist.position.x;
        let s = 1;
        if (pt < 0.06) s = 1 - 0.3 * (pt / 0.06);                                  // coil back
        else if (pt < 0.14) s = 0.7 + (STRETCH - 0.7) * ((pt - 0.06) / 0.08);      // SHOOT!
        else if (pt < 0.22) s = STRETCH;                                           // full stretch
        else s = STRETCH + (1 - STRETCH) * Math.min(1, (pt - 0.22) / 0.2);         // snap back
        const aim = Math.min(1, pt / 0.06);
        const back = pt > 0.22 ? 1 - Math.min(1, (pt - 0.22) / 0.2) : 1;
        arm.pivot.rotation.y = aimRot * aim * back;
        arm.arm.scale.x = side * s;
        // rubber-hose: the arm fattens as it stretches, so the shot reads
        // even when it points straight away from the camera
        const fat = 1 + 1.5 * Math.max(0, (s - 1) / (STRETCH - 1));
        arm.arm.scale.y = fat;
        arm.arm.scale.z = fat;
        arm.fist.position.x = arm.fistRestX + side * (s - 1);
        arm.fist.scale.setScalar(pt > 0.06 && pt < 0.26 ? 1.6 : 1);
      }
      if (!f.punch.hit && pt >= 0.12) { f.punch.hit = true; if (f.alive) f.punch.landed = resolvePunchHit(f); }
      if (f.punch.hit && !f.punch.hit2 && pt >= 0.21) {
        f.punch.hit2 = true;
        if (f.alive && !f.punch.landed) f.punch.landed = resolvePunchHit(f, true);
      }
      if (pt > 0.44) {
        if (arm && arm.pivot && arm.arm) {
          arm.pivot.rotation.y = 0;
          arm.arm.scale.set(side, 1, 1);
          arm.fist.position.x = arm.fistRestX;
          arm.fist.scale.setScalar(1);
        }
        f.punch = null;
      }
    } else {
      // ---- everyone else: the swing / tail whip ----
      const sign = f.punch.arm === 'right' ? -1 : 1;
      if (arm && arm.pivot) {
        let ang = 0;
        if (pt < 0.07) ang = -sign * 0.5 * (pt / 0.07);                        // wind-up
        else if (pt < 0.19) ang = sign * 1.5 * ((pt - 0.07) / 0.12) - sign * 0.5; // strike!
        else ang = sign * 1.0 * (1 - Math.min(1, (pt - 0.19) / 0.26));         // recover
        arm.pivot.rotation.y = ang;
        const s = pt > 0.07 && pt < 0.22 ? 1.35 : 1;
        if (arm.fist) arm.fist.scale.setScalar(s);
      }
      // the swing stays "live" through two checks, so an enemy walking in
      // (or barely stepping out) during the strike frames still gets clipped
      if (!f.punch.hit && pt >= 0.11) { f.punch.hit = true; if (f.alive) f.punch.landed = resolvePunchHit(f); }
      if (f.punch.hit && !f.punch.hit2 && pt >= 0.2) {
        f.punch.hit2 = true;
        if (f.alive && !f.punch.landed) f.punch.landed = resolvePunchHit(f, true);
      }
      if (pt > 0.45) {
        if (arm && arm.pivot) arm.pivot.rotation.y = 0;
        if (arm && arm.fist) arm.fist.scale.setScalar(1);
        f.punch = null;
      }
    }
  }

  // idle personality + hit flash wobble
  if (f.alive) {
    f.built.idle && f.built.idle(t);
    if (f.hitstun > 0) f.built.group.rotation.z = Math.sin(t * 40) * 0.06 * (f.hitstun / HIT_STUN);
    else f.built.group.rotation.z = 0;
  }

  // blob shadow
  const h = Math.max(0, p.y - f.centerY);
  f.shadow.position.set(p.x, 0.02, p.z);
  const sc = Math.max(0.45, 1 - h * 0.12);
  f.shadow.scale.setScalar(sc);
  f.shadow.material.opacity = 0.14 * sc;
}

// ---------- Camera ----------
const camTarget = new THREE.Vector3();
function updateCamera(dt, t) {
  const me = fighters[0];
  const p = me.removed ? camTarget : me.body.translation();
  camTarget.lerp(new THREE.Vector3(p.x, 0, p.z), Math.min(1, dt * 5));
  const want = new THREE.Vector3(camTarget.x, 8.6, camTarget.z + 11.2);
  camera.position.lerp(want, Math.min(1, dt * 4));
  shake = Math.max(0, shake - dt * 1.6);
  const sh = shake * shake;
  camera.position.x += Math.sin(t * 51) * sh * 0.5;
  camera.position.y += Math.sin(t * 47) * sh * 0.35;
  camera.lookAt(camTarget.x, 1.2, camTarget.z);
}

// ---------- Boot ----------
RAPIER.init().then(() => {
  setupPhysics();
  for (const spec of FIGHTER_SPECS) fighters.push(makeFighter(spec));

  const clock = new THREE.Clock();
  let acc = 0;
  let simT = 0;
  function update(dt) {
    simT += dt;
    uTime.value = simT;
    if (state !== 'intro') {
      acc += dt;
      let steps = 0;
      while (acc >= 1 / 60 && steps < 3) { world.step(); acc -= 1 / 60; steps++; }
      checkTreeBonks();
    }
    for (const f of fighters) updateFighter(f, dt, simT);
    updateTrees(dt);
    updateFX(dt);
    updateCamera(dt, simT);
  }
  function render() { effect.render(scene, camera); }
  function tick() {
    requestAnimationFrame(tick);
    update(Math.min(clock.getDelta(), 0.05));
    render();
  }
  // debug hook (project convention): rAF pauses while the Browser pane is
  // hidden — step update() manually when testing headlessly.
  window.__punch = { fighters, keys, update, render, get state() { return state; } };
  tick();
});
