import * as THREE from 'three';
import { createApp } from './kit/app.js';
import { toonMat, flatMat, spriteMat, noOutline, blobShadow, canvasTex, instancedHull, clamp, smooth, angleDiff } from './kit/toon.js';
import { createInput } from './kit/input.js';
import { createHud } from './kit/hud.js';
import { beep, noise, chord } from './kit/audio.js';

// The kid's spec (told, not drawn): you are the big dinosaur in an endless maze, you eat
// the little dinosaurs, a fire-breathing dragon hunts you, speeds are 5 / 4 out of 10.
// The round now has a GOAL: eat enough little dinos and the exit opens — reach it to win.

// ---------- Marker palette (same paper world as the other games) ----------
const TREX_GREEN = 0x4a9c3d;
const TREX_DARK = 0x1f5c17;
const TREX_JAW = 0x3c8030;
const DRAGON_RED = 0xc9342a;
const DRAGON_DARK = 0x6e120b;
const WALL_BROWN = 0x6b4e30;
const INK = 0x2a2118;

// ---------- Tuning ----------
const SPD = 1.3;               // one speed point = 1.3 world units per second
const PLAYER_SPEED = 6 * SPD;
const DINO_SPEED = 5 * SPD;
const DRAGON_SPEED = 4 * SPD;
const BOOST_MUL = 1.55;        // eating chains into a sprint
const BOOST_T = 1.7;
const GOAL_EAT = 15;           // eat this many and the exit opens
const ROUND_TIME = 150;        // then the dragons get angry (overtime)
const DINO_COUNT = 7;
const EAT_DIST = 1.7;
const DRAGON_HP = 3;
const FIRE_RANGE = 11;
const CHARGE_T = 0.85;         // the dragon inhales... (your warning)
const BREATH_T = 0.95;         // ...and breathes
const FIRE_R = 1.05;
const SHOT_CD = 0.45;
const SHOT_SPEED = 16;
const EXIT_DIST = 2.0;

// ---------- The endless maze ----------
const CELL = 4.5;
const WALL_T = 0.6;
const WALL_H = 1.7;
const HT = WALL_T / 2;
const LOOP_P = 0.3;            // extra carved openings => loops => escape routes
const VIEW_R = 6;              // cells of maze kept built around the player

let SEED = 1234567;
function h2(i, j, s) {
  let h = Math.imul(i, 0x27d4eb2d) ^ Math.imul(j, 0x165667b1) ^ Math.imul(s + 7, 0x9e3779b1) ^ Math.imul(SEED, 0x85ebca77);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
// binary-tree maze: every cell carves north OR east, so the whole infinite thing stays
// connected — computed from the hash alone, no chunk storage.
const inPlaza = (i, j) => Math.abs(i) <= 1 && Math.abs(j) <= 1;
const carveN = (i, j) => h2(i, j, 1) < 0.5;
function openZ(i, j) {
  if (inPlaza(i, j) && inPlaza(i, j + 1)) return true;
  return carveN(i, j) || h2(i, j, 2) < LOOP_P;
}
function openX(i, j) {
  if (inPlaza(i, j) && inPlaza(i + 1, j)) return true;
  return !carveN(i, j) || h2(i, j, 3) < LOOP_P;
}
const cellOf = (v) => Math.floor(v / CELL);
const cellCX = (i) => (i + 0.5) * CELL;
function openNeighborCells(i, j) {
  const out = [];
  if (openX(i, j)) out.push([i + 1, j]);
  if (openX(i - 1, j)) out.push([i - 1, j]);
  if (openZ(i, j)) out.push([i, j + 1]);
  if (openZ(i, j - 1)) out.push([i, j - 1]);
  return out;
}
function pushOutBox(pos, r, x0, x1, z0, z1) {
  const cx = Math.max(x0, Math.min(pos.x, x1));
  const cz = Math.max(z0, Math.min(pos.z, z1));
  const dx = pos.x - cx, dz = pos.z - cz;
  const d2 = dx * dx + dz * dz;
  if (d2 >= r * r) return;
  if (d2 > 1e-9) {
    const d = Math.sqrt(d2);
    pos.x += (dx / d) * (r - d);
    pos.z += (dz / d) * (r - d);
  } else {
    const exits = [[pos.x - x0 + r, -1, 0], [x1 - pos.x + r, 1, 0], [pos.z - z0 + r, 0, -1], [z1 - pos.z + r, 0, 1]];
    exits.sort((a, b) => a[0] - b[0]);
    pos.x += exits[0][1] * exits[0][0];
    pos.z += exits[0][2] * exits[0][0];
  }
}
function forNearbyWalls(x, z, fn) {
  const ci = cellOf(x), cj = cellOf(z);
  for (let i = ci - 1; i <= ci + 1; i++) {
    for (let j = cj - 1; j <= cj + 1; j++) {
      if (!openX(i, j)) fn((i + 1) * CELL - HT, (i + 1) * CELL + HT, j * CELL - HT, (j + 1) * CELL + HT);
      if (!openZ(i, j)) fn(i * CELL - HT, (i + 1) * CELL + HT, (j + 1) * CELL - HT, (j + 1) * CELL + HT);
    }
  }
}
function collideWalls(pos, r) {
  for (let pass = 0; pass < 2; pass++) forNearbyWalls(pos.x, pos.z, (x0, x1, z0, z1) => pushOutBox(pos, r, x0, x1, z0, z1));
}
function pointBlocked(x, z, pad = 0.08) {
  let hit = false;
  forNearbyWalls(x, z, (x0, x1, z0, z1) => { if (x > x0 - pad && x < x1 + pad && z > z0 - pad && z < z1 + pad) hit = true; });
  return hit;
}
function losClear(ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const len = Math.hypot(dx, dz);
  if (len < 0.001) return true;
  const ux = dx / len, uz = dz / len;
  for (let t = 0.3; t < len; t += 0.3) if (pointBlocked(ax + ux * t, az + uz * t, 0.02)) return false;
  return true;
}
function marchReach(ax, az, ux, uz, maxLen) {
  for (let t = 0.4; t < maxLen; t += 0.3) if (pointBlocked(ax + ux * t, az + uz * t, 0.1)) return t;
  return maxLen;
}
function distToSegXZ(px, pz, ax, az, bx, bz) {
  const abx = bx - ax, abz = bz - az;
  const l2 = abx * abx + abz * abz;
  let t = l2 > 1e-9 ? ((px - ax) * abx + (pz - az) * abz) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + abx * t), pz - (az + abz * t));
}

// ---------- App ----------
const app = createApp({ fov: 46, outline: { thickness: 0.005, color: INK } });
const { scene, camera, juice } = app;
camera.position.set(cellCX(0), 29, cellCX(0) + 10.5);
camera.lookAt(cellCX(0), 0, cellCX(0));
const input = createInput();
app.input = input;
const hud = createHud(app, { gameId: 'dino', music: { seed: 3, bpm: 120, root: 62 } });
if (input.touch) input.touch.setLabels({ a: '💥', b: '' });

// ---------- Hand-drawn textures ----------
const groundTex = canvasTex(512, (g) => {
  g.fillStyle = '#f8f5ec';
  g.fillRect(0, 0, 512, 512);
  g.lineCap = 'round';
  for (let i = 0; i < 90; i++) {
    const x = Math.random() * 512, y = Math.random() * 512;
    g.strokeStyle = ['#86bb6a', '#6da653', '#9cc884'][i % 3];
    g.globalAlpha = 0.55;
    g.lineWidth = 3;
    for (let k = -1; k <= 1; k++) {
      g.beginPath(); g.moveTo(x + k * 4, y); g.lineTo(x + k * 6, y - 8 - Math.random() * 5); g.stroke();
    }
  }
  g.globalAlpha = 0.4;
  for (let i = 0; i < 40; i++) {
    g.fillStyle = ['#e8b62c', '#d95f9e', '#8fbf8a'][i % 3];
    g.beginPath(); g.arc(Math.random() * 512, Math.random() * 512, 2.2, 0, Math.PI * 2); g.fill();
  }
  g.globalAlpha = 1;
}, { wrap: true, repeat: [16, 16] });
const wallTex = canvasTex(256, (g) => {
  g.fillStyle = '#b99772';
  g.fillRect(0, 0, 256, 256);
  g.lineCap = 'round';
  g.strokeStyle = '#8f6f4e';
  g.globalAlpha = 0.45;
  g.lineWidth = 4;
  for (let i = 0; i < 42; i++) {
    const x = Math.random() * 256, y = Math.random() * 256, l = 14 + Math.random() * 22;
    const a = (Math.random() < 0.5 ? 1 : -1) * (0.6 + Math.random() * 0.3);
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
  }
  g.globalAlpha = 0.25;
  g.fillStyle = '#a5825e';
  for (let i = 0; i < 14; i++) { g.beginPath(); g.arc(Math.random() * 256, Math.random() * 256, 10 + Math.random() * 16, 0, Math.PI * 2); g.fill(); }
  g.globalAlpha = 1;
}, { wrap: true });
const flameTex = canvasTex(128, (g) => {
  const ring = (r, color, n, spread) => {
    g.fillStyle = color;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      g.beginPath(); g.arc(64 + Math.cos(a) * spread, 64 + Math.sin(a) * spread, r, 0, Math.PI * 2); g.fill();
    }
  };
  ring(26, '#e8481c', 7, 22);
  ring(24, '#ff8c1f', 6, 12);
  g.fillStyle = '#ffd23e';
  g.beginPath(); g.arc(64, 64, 24, 0, Math.PI * 2); g.fill();
});
const smokeTex = canvasTex(128, (g) => {
  const grays = ['#9a938a', '#b5aca0', '#847d73'];
  for (let i = 0; i < 9; i++) {
    g.fillStyle = grays[i % 3];
    const a = (i / 9) * Math.PI * 2;
    g.beginPath(); g.arc(64 + Math.cos(a) * 16, 64 + Math.sin(a) * 16, 24, 0, Math.PI * 2); g.fill();
  }
});
const starTexOf = (fill, stroke) => canvasTex(128, (g) => {
  g.fillStyle = fill; g.strokeStyle = stroke; g.lineWidth = 7; g.lineJoin = 'round';
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? 56 : 26;
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const x = 64 + Math.cos(a) * r, y = 64 + Math.sin(a) * r;
    i === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
  }
  g.closePath(); g.fill(); g.stroke();
});
const starTexs = [starTexOf('#ffd23e', '#c98f0e'), starTexOf('#7ed957', '#2f8a25'), starTexOf('#ff8bb3', '#c2417a'), starTexOf('#fff8e0', '#c98f0e')];
const wingTex = canvasTex(128, (g) => {
  g.fillStyle = '#ef8a63'; g.strokeStyle = '#6e120b'; g.lineWidth = 6; g.lineJoin = 'round';
  g.beginPath();
  g.moveTo(8, 96);
  g.quadraticCurveTo(30, 10, 122, 12);
  g.quadraticCurveTo(104, 48, 96, 88);
  g.quadraticCurveTo(74, 74, 62, 96);
  g.quadraticCurveTo(40, 78, 8, 96);
  g.closePath(); g.fill(); g.stroke();
  g.lineWidth = 4;
  [[100, 30], [76, 46], [48, 66]].forEach(([x, y]) => { g.beginPath(); g.moveTo(14, 92); g.lineTo(x, y); g.stroke(); });
});
const boneTex = canvasTex(96, (g) => {
  g.strokeStyle = '#b9a98a'; g.fillStyle = '#efe9da'; g.lineWidth = 5;
  g.save(); g.translate(48, 48); g.rotate(0.6);
  g.beginPath(); g.roundRect(-26, -6, 52, 12, 6); g.fill(); g.stroke();
  [[-26, -8], [-26, 8], [26, -8], [26, 8]].forEach(([x, y]) => { g.beginPath(); g.arc(x, y, 9, 0, Math.PI * 2); g.fill(); g.stroke(); });
  g.restore();
});
const flowerTex = canvasTex(96, (g) => {
  g.fillStyle = '#e78fbe';
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; g.beginPath(); g.arc(48 + Math.cos(a) * 17, 48 + Math.sin(a) * 17, 13, 0, Math.PI * 2); g.fill(); }
  g.fillStyle = '#ecc94d';
  g.beginPath(); g.arc(48, 48, 12, 0, Math.PI * 2); g.fill();
});
const pebbleTex = canvasTex(96, (g) => {
  g.fillStyle = '#cdc4b2'; g.strokeStyle = '#9a8f78'; g.lineWidth = 5;
  [[30, 56, 16], [58, 50, 13], [46, 68, 10]].forEach(([x, y, r]) => { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); g.stroke(); });
});
const doorTex = canvasTex(128, (g) => { // the exit: a dark cave mouth with a marker swirl
  g.fillStyle = '#1e3a1a';
  g.beginPath(); g.arc(64, 64, 54, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#7ed957'; g.lineWidth = 7; g.lineCap = 'round';
  g.beginPath();
  for (let a = 0; a <= Math.PI * 4; a += 0.08) { const r = 6 + a * 3.6; const x = 64 + Math.cos(a) * r, y = 64 + Math.sin(a) * r; a === 0 ? g.moveTo(x, y) : g.lineTo(x, y); }
  g.stroke();
});

// ---------- The floor (an endless paper meadow that follows you) ----------
const FLOOR_SNAP = 15;
const floor = new THREE.Mesh(new THREE.PlaneGeometry(FLOOR_SNAP * 16, FLOOR_SNAP * 16), noOutline(new THREE.MeshBasicMaterial({ map: groundTex })));
floor.rotation.x = -Math.PI / 2;
scene.add(floor);

// ---------- The walls (instanced, rebuilt as you roam, hull-outlined) ----------
const MAXW = 520;
const wallGeoX = new THREE.BoxGeometry(CELL + WALL_T, WALL_H, WALL_T);
const wallGeoZ = new THREE.BoxGeometry(WALL_T, WALL_H, CELL + WALL_T);
const wallMat = toonMat(0xffffff, { map: wallTex });
const wallsX = new THREE.InstancedMesh(wallGeoX, wallMat, MAXW);
const wallsZ = new THREE.InstancedMesh(wallGeoZ, wallMat, MAXW);
const wallsXOut = instancedHull(wallsX, { color: WALL_BROWN, thickness: 0.08 });
const wallsZOut = instancedHull(wallsZ, { color: WALL_BROWN, thickness: 0.08 });
[wallsX, wallsZ, wallsXOut, wallsZOut].forEach((m) => { m.frustumCulled = false; scene.add(m); });
const _m4 = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3(1, 1, 1);
const _p = new THREE.Vector3();

// flat doodads sprinkled through the maze so the endlessness feels alive
const DOODADS = 44;
const doodadPool = [];
for (let k = 0; k < DOODADS; k++) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), spriteMat(boneTex));
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.045;
  mesh.renderOrder = 1;
  mesh.visible = false;
  scene.add(mesh);
  doodadPool.push(mesh);
}

let wallCi = Infinity, wallCj = Infinity;
function rebuildWalls(force = false) {
  const ci = cellOf(player.group.position.x), cj = cellOf(player.group.position.z);
  if (!force && ci === wallCi && cj === wallCj) return;
  wallCi = ci; wallCj = cj;
  let nx = 0, nz = 0, nd = 0;
  _q.identity();
  for (let i = ci - VIEW_R; i <= ci + VIEW_R; i++) {
    for (let j = cj - VIEW_R; j <= cj + VIEW_R; j++) {
      if (!openZ(i, j) && nx < MAXW) {
        _p.set(cellCX(i), WALL_H / 2, (j + 1) * CELL);
        _m4.compose(_p, _q, _s);
        wallsX.setMatrixAt(nx++, _m4);
      }
      if (!openX(i, j) && nz < MAXW) {
        _p.set((i + 1) * CELL, WALL_H / 2, cellCX(j));
        _m4.compose(_p, _q, _s);
        wallsZ.setMatrixAt(nz++, _m4);
      }
      if (nd < DOODADS && h2(i, j, 7) < 0.13) {
        const d = doodadPool[nd++];
        const kind = h2(i, j, 8);
        d.material.map = kind < 0.34 ? boneTex : kind < 0.72 ? flowerTex : pebbleTex;
        const sc = 0.75 + h2(i, j, 9) * 0.5;
        d.scale.set(sc, sc, 1);
        d.position.x = cellCX(i) + (h2(i, j, 10) - 0.5) * 1.6;
        d.position.z = cellCX(j) + (h2(i, j, 11) - 0.5) * 1.6;
        d.rotation.z = h2(i, j, 12) * Math.PI * 2;
        d.visible = true;
      }
    }
  }
  for (let k = nd; k < DOODADS; k++) doodadPool[k].visible = false;
  wallsX.count = wallsXOut.count = nx;
  wallsZ.count = wallsZOut.count = nz;
  wallsX.instanceMatrix.needsUpdate = true;
  wallsZ.instanceMatrix.needsUpdate = true;
}

// ---------- The big dino (that's you!) ----------
function makeTrex() {
  const g = new THREE.Group();
  const mats = [];
  const mat = (c) => { const m = toonMat(c, { outline: TREX_DARK, unique: true }); mats.push(m); return m; };
  const body = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), mat(TREX_GREEN));
  body.scale.set(0.95, 0.8, 1.25);
  body.position.y = 1.0;
  g.add(body);
  for (let k = 0; k < 4; k++) { // spikes down the spine — this is what you see from above
    const sp = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.42, 6), mat(TREX_DARK));
    sp.position.set(0, 1.72 - k * 0.1, -0.1 - k * 0.42);
    sp.rotation.x = -0.5;
    g.add(sp);
  }
  const head = new THREE.Group();
  head.position.set(0, 1.62, 0.95);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.62, 18, 12), mat(TREX_GREEN));
  skull.scale.set(1, 0.85, 1.05);
  head.add(skull);
  const snout = new THREE.Mesh(new THREE.SphereGeometry(0.4, 14, 10), mat(TREX_GREEN));
  snout.scale.set(0.85, 0.6, 1.05);
  snout.position.set(0, -0.12, 0.48);
  head.add(snout);
  const jaw = new THREE.Group();
  jaw.position.set(0, -0.3, 0.1);
  const jawMesh = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.2, 0.85), mat(TREX_JAW));
  jawMesh.position.set(0, -0.1, 0.42);
  jaw.add(jawMesh);
  for (let k = -1; k <= 1; k++) {
    const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.16, 5), flatMat(0xffffff));
    tooth.position.set(k * 0.16, 0.06, 0.78);
    jaw.add(tooth);
  }
  head.add(jaw);
  [-1, 1].forEach((sx) => {
    const eyeM = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 10), flatMat(0xffffff, { outline: TREX_DARK }));
    eyeM.position.set(sx * 0.3, 0.3, 0.3);
    head.add(eyeM);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), flatMat(INK));
    pupil.position.set(sx * 0.32, 0.34, 0.43);
    head.add(pupil);
  });
  g.add(head);
  const tail = new THREE.Group();
  [[0.45, -1.15, 0.85], [0.32, -1.62, 0.72], [0.2, -2.0, 0.6]].forEach(([r, z, y]) => {
    const seg = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), mat(TREX_GREEN));
    seg.position.set(0, y, z);
    tail.add(seg);
  });
  g.add(tail);
  const legs = [];
  [-1, 1].forEach((sx) => {
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.5, 4, 8), mat(TREX_JAW));
    leg.position.set(sx * 0.45, 0.45, -0.05);
    g.add(leg);
    legs.push(leg);
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.3, 4, 8), mat(TREX_JAW));
    arm.position.set(sx * 0.6, 1.05, 0.75);
    arm.rotation.x = 0.9;
    g.add(arm);
  });
  const shadow = blobShadow(1.25, { y: 0.03 });
  g.add(shadow);
  return { group: g, head, jaw, tail, legs, shadow, mats, origColors: mats.map((m) => m.color.getHex()), jawT: 0 };
}

// ---------- The little dinos (lunch) ----------
const MINI_COLORS = [[0xe8862c, 0x9c5210], [0x2b9d97, 0x155a56], [0x8656c9, 0x4b2a7a], [0xd95f9e, 0x8f2f63], [0xd9b32c, 0x8a6d0e]];
function makeMini(colorIx) {
  const [col, dark] = MINI_COLORS[colorIx % MINI_COLORS.length];
  const g = new THREE.Group();
  const main = toonMat(col, { outline: dark });
  const darkMat = toonMat(dark, { outline: dark });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 12), main);
  body.scale.set(1, 0.92, 1.15);
  body.position.y = 0.55;
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.36, 14, 10), main);
  head.position.set(0, 1.0, 0.42);
  g.add(head);
  const crest = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.26, 6), darkMat);
  crest.position.set(0, 1.36, 0.3);
  g.add(crest);
  [-1, 1].forEach((sx) => {
    const eyeM = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), flatMat(0xffffff, { outline: dark }));
    eyeM.position.set(sx * 0.18, 1.12, 0.62);
    g.add(eyeM);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), flatMat(INK));
    pupil.position.set(sx * 0.19, 1.13, 0.71);
    g.add(pupil);
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.2, 4, 6), darkMat);
    leg.position.set(sx * 0.26, 0.2, 0);
    g.add(leg);
  });
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.55, 8), main);
  tail.rotation.x = Math.PI / 2 + 0.55;
  tail.position.set(0, 0.5, -0.7);
  g.add(tail);
  g.add(blobShadow(0.62, { y: 0.03 }));
  return g;
}

// ---------- The dragons (uh oh) ----------
function makeDragonMesh() {
  const g = new THREE.Group();
  const mats = [];
  const mat = (c) => { const m = toonMat(c, { outline: DRAGON_DARK, unique: true }); mats.push(m); return m; };
  const body = new THREE.Mesh(new THREE.SphereGeometry(1.05, 20, 14), mat(DRAGON_RED));
  body.scale.set(1, 0.9, 1.4);
  body.position.y = 1.15;
  g.add(body);
  for (let k = 0; k < 3; k++) {
    const sp = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.4, 6), mat(DRAGON_DARK));
    sp.position.set(0, 1.95 - k * 0.12, -0.2 - k * 0.5);
    sp.rotation.x = -0.5;
    g.add(sp);
  }
  const head = new THREE.Group();
  head.position.set(0, 1.85, 1.25);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.6, 18, 12), mat(DRAGON_RED));
  skull.scale.set(1, 0.85, 1.1);
  head.add(skull);
  const snout = new THREE.Mesh(new THREE.SphereGeometry(0.38, 14, 10), mat(DRAGON_RED));
  snout.scale.set(0.85, 0.6, 1.05);
  snout.position.set(0, -0.1, 0.5);
  head.add(snout);
  [-1, 1].forEach((sx) => {
    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.45, 6), flatMat(0xf3ead4, { outline: DRAGON_DARK }));
    horn.position.set(sx * 0.24, 0.48, -0.15);
    horn.rotation.x = -0.45;
    head.add(horn);
    const eyeM = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 10), flatMat(0xffe9a8, { outline: DRAGON_DARK }));
    eyeM.position.set(sx * 0.28, 0.26, 0.32);
    head.add(eyeM);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), flatMat(INK));
    pupil.position.set(sx * 0.29, 0.28, 0.44);
    head.add(pupil);
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.08, 0.09), mat(DRAGON_DARK));
    brow.position.set(sx * 0.26, 0.45, 0.36);
    brow.rotation.z = sx * -0.5;
    head.add(brow);
  });
  g.add(head);
  const wings = [];
  [-1, 1].forEach((sx) => {
    const wing = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.55), spriteMat(wingTex, { side: THREE.DoubleSide, depthWrite: true }));
    wing.geometry.translate(1.1, 0, 0);
    wing.rotation.x = -Math.PI / 2 + 0.15;
    wing.position.set(sx * 0.55, 1.95, -0.15);
    if (sx < 0) wing.scale.x = -1;
    g.add(wing);
    wings.push(wing);
  });
  const tail = new THREE.Group();
  [[0.4, -1.6, 1.0], [0.27, -2.1, 0.85]].forEach(([r, z, y]) => {
    const seg = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), mat(DRAGON_RED));
    seg.position.set(0, y, z);
    tail.add(seg);
  });
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.5, 4), mat(DRAGON_DARK));
  tip.rotation.x = Math.PI / 2 + 2.6;
  tip.position.set(0, 0.78, -2.5);
  tail.add(tip);
  g.add(tail);
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), spriteMat(flameTex, { opacity: 0.9 }));
  glow.rotation.x = -Math.PI / 2;
  glow.position.set(0, 1.7, 2.2);
  glow.renderOrder = 3;
  glow.visible = false;
  g.add(glow);
  g.add(blobShadow(1.5, { y: 0.03 }));
  // hp pips float over the dragon (not rotating with it)
  const pips = new THREE.Group();
  for (let k = 0; k < DRAGON_HP; k++) {
    const pip = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.55), spriteMat(flameTex));
    pip.rotation.x = -Math.PI / 2;
    pip.position.set((k - 1) * 0.7, 3.3, 0);
    pip.renderOrder = 3;
    pips.add(pip);
  }
  scene.add(pips);
  return { group: g, head, wings, tail, glow, mats, pips };
}
function makeDragon() {
  const m = makeDragonMesh();
  scene.add(m.group);
  const d = {
    ...m,
    phase: 'chase', // chase | charge | breath | stun | down | gone
    cell: { i: 9, j: 0 }, next: { i: 9, j: 0 }, prev: { i: 99, j: 99 },
    hp: DRAGON_HP, fireCd: 3, chargeT: 0, breathT: 0, stunT: 0, downT: 0, goneT: 0,
    aimX: 0, aimZ: 1, reach: 0, yaw: 0, flap: Math.random() * 6, hitFlash: 0,
    returns: 0,     // every time it's driven off it comes back a little meaner
    arrow: makeArrow('🐉', false),
  };
  return d;
}

// ---------- The exit: a cave mouth that appears once you've eaten enough ----------
const exit = { active: false, cell: { i: 0, j: 0 }, group: new THREE.Group(), arrow: makeArrow('🚪', true), spin: 0 };
{
  const door = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 3.4), spriteMat(doorTex));
  door.rotation.x = -Math.PI / 2;
  door.position.y = 0.06;
  door.renderOrder = 2;
  exit.group.add(door);
  exit.door = door;
  for (let k = 0; k < 7; k++) { // a ring of marker stones
    const a = (k / 7) * Math.PI * 2;
    const stone = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42 + (k % 2) * 0.12, 1), toonMat(0xcdc4b2, { outline: 0x6b5d4a }));
    stone.position.set(Math.cos(a) * 1.9, 0.3, Math.sin(a) * 1.9);
    exit.group.add(stone);
  }
  const flag = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.4, 6), flatMat(INK));
  pole.position.y = 1.2;
  const cloth = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.7), toonMat(0x7ed957, { outline: 0x2f8a25, side: THREE.DoubleSide }));
  cloth.position.set(0.58, 2.0, 0);
  flag.add(pole, cloth);
  flag.position.set(-2.2, 0, -1.4);
  exit.group.add(flag);
  exit.group.visible = false;
  scene.add(exit.group);
}

// ---------- Pools: flames, smoke, stars, shots ----------
const puffPool = [];
for (let k = 0; k < 46; k++) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), spriteMat(flameTex));
  mesh.rotation.x = -Math.PI / 2;
  mesh.renderOrder = 2;
  mesh.visible = false;
  scene.add(mesh);
  puffPool.push({ mesh, active: false, life: 0, maxLife: 1, vx: 0, vz: 0, grow: 1 });
}
function spawnPuff(x, z, smoke = false, scale = 1, vx = 0, vz = 0) {
  const p = puffPool.find((q) => !q.active) || puffPool[0];
  p.active = true;
  p.mesh.visible = true;
  p.mesh.material.map = smoke ? smokeTex : flameTex;
  p.mesh.material.opacity = 0.95;
  p.life = 0;
  p.maxLife = smoke ? 0.7 : 0.45;
  p.grow = smoke ? 1.6 : 2.2;
  p.vx = vx; p.vz = vz;
  p.mesh.position.set(x, 0.09 + Math.random() * 0.25, z);
  p.mesh.rotation.z = Math.random() * Math.PI * 2;
  p.mesh.scale.setScalar(scale * (0.55 + Math.random() * 0.3));
}
const starPool = [];
for (let k = 0; k < 40; k++) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.55), spriteMat(starTexs[k % 4]));
  mesh.rotation.x = -Math.PI / 2;
  mesh.renderOrder = 3;
  mesh.visible = false;
  scene.add(mesh);
  starPool.push({ mesh, active: false, life: 0, maxLife: 1, vx: 0, vy: 0, vz: 0, spin: 0 });
}
function poofStars(x, y, z, n, toss = false) {
  for (let k = 0; k < n; k++) {
    const s = starPool.find((q) => !q.active) || starPool[k % starPool.length];
    const a = Math.random() * Math.PI * 2;
    const sp = 1.5 + Math.random() * 2.5;
    s.active = true;
    s.mesh.visible = true;
    s.mesh.material.opacity = 1;
    s.life = 0;
    s.maxLife = toss ? 1.1 : 0.55;
    s.vx = Math.cos(a) * sp; s.vz = Math.sin(a) * sp; s.vy = toss ? 4 + Math.random() * 3 : 0;
    s.spin = (Math.random() - 0.5) * 12;
    s.mesh.position.set(x, y + Math.random() * 0.3, z);
    s.mesh.scale.setScalar(0.7 + Math.random() * 0.7);
  }
}
const shotPool = [];
for (let k = 0; k < 8; k++) {
  const g = new THREE.Group();
  const star = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.8), spriteMat(starTexs[0]));
  star.rotation.x = -Math.PI / 2;
  star.renderOrder = 3;
  g.add(star);
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), flatMat(0xff8c1f)));
  g.position.y = 1.0;
  g.visible = false;
  scene.add(g);
  shotPool.push({ group: g, star, active: false, vx: 0, vz: 0, life: 0 });
}

// ---------- Audio ----------
const chompSound = () => { beep(170, 0, 0.08, 'square', 0.16); beep(95, 0.06, 0.12, 'square', 0.14); noise(0.13, 900, 0.14); };
const comboSound = (n) => beep(520 + n * 90, 0, 0.09, 'triangle', 0.1, 900 + n * 120);
const shootSound = () => beep(620, 0, 0.06, 'triangle', 0.1, 1100);
const hitSound = () => { beep(240, 0, 0.08, 'sawtooth', 0.13); beep(480, 0.05, 0.06, 'square', 0.1); noise(0.08, 2200, 0.08); };
const downSound = () => { chord([520, 390, 270, 170], 0.11, 0.16, 'sawtooth', 0.12); noise(0.5, 500, 0.12, 0.1); };
const chargeSound = () => { beep(260, 0, CHARGE_T, 'triangle', 0.08, 980); noise(CHARGE_T, 2600, 0.03); };
const breathSound = () => { noise(BREATH_T, 620, 0.2); noise(BREATH_T * 0.8, 1400, 0.08, 0.05); };
const deathSound = () => { chord([400, 300, 220, 150], 0.18, 0.3, 'sawtooth', 0.12); noise(0.8, 700, 0.16); };
const winSound = () => { chord([392, 494, 587, 784, 988], 0.14, 0.22, 'triangle', 0.12); beep(1175, 0.7, 0.5, 'triangle', 0.12); };
const tickSound = () => beep(1150, 0, 0.03, 'square', 0.05);
const roarSound = () => { beep(120, 0, 0.5, 'sawtooth', 0.15, 65); noise(0.4, 300, 0.12); };
const exitSound = () => chord([523, 659, 784, 1047], 0.09, 0.3, 'triangle', 0.12);

// ---------- Game state ----------
const state = {
  phase: 'idle', // idle | play | dead | win | over
  t: 0,
  score: 0,
  eaten: 0,
  combo: 0,
  boostT: 0,
  dragonsDown: 0,
  shotCd: 0,
  deathT: 0,
  winT: 0,
  flameEmit: 0,
  smokeEmit: 0,
  chargeWarned: 0,
  lastTickSec: -1,
  overtime: false,
  vel: new THREE.Vector3(),
  runPhase: 0,
};

const player = makeTrex();
scene.add(player.group);
const dinos = [];
for (let k = 0; k < DINO_COUNT; k++) {
  const group = makeMini(k);
  scene.add(group);
  dinos.push({ group, cell: { i: 0, j: 0 }, next: { i: 0, j: 0 }, prev: { i: 99, j: 99 }, hopPhase: Math.random() * 6, swapCd: 0, popT: 1, yaw: 0 });
}
const dragons = [makeDragon()];

// ---------- HUD ----------
function makeArrow(emoji, isExit) {
  const el = document.createElement('div');
  el.className = 'hud arrow' + (isExit ? ' exit' : '');
  el.textContent = emoji;
  document.getElementById('arrows').appendChild(el);
  return el;
}
function setScore() {
  hud.set('#score', `🍖 ${Math.min(state.eaten, GOAL_EAT)}/${GOAL_EAT}`);
  hud.pop('#score');
}

// ---------- Spawning ----------
function ringCell(fromI, fromJ, minR, maxR) {
  const a = Math.random() * Math.PI * 2;
  const r = minR + Math.random() * (maxR - minR);
  return { i: fromI + Math.round(Math.cos(a) * r), j: fromJ + Math.round(Math.sin(a) * r) };
}
function placeDino(d, minR, maxR) {
  const pi = cellOf(player.group.position.x), pj = cellOf(player.group.position.z);
  const c = ringCell(pi, pj, minR, maxR);
  d.cell = { ...c };
  d.next = { ...c };
  d.prev = { i: c.i + 99, j: c.j };
  d.group.position.set(cellCX(c.i), 0, cellCX(c.j));
  d.popT = 0;
  dinoDecide(d);
}
function placeDragon(d, minR, maxR) {
  const pi = cellOf(player.group.position.x), pj = cellOf(player.group.position.z);
  const c = ringCell(pi, pj, minR, maxR);
  d.cell = { ...c };
  d.next = { ...c };
  d.prev = { i: c.i + 99, j: c.j };
  d.group.position.set(cellCX(c.i), 0, cellCX(c.j));
}
function openExit() {
  const pi = cellOf(player.group.position.x), pj = cellOf(player.group.position.z);
  exit.cell = ringCell(pi, pj, 7, 9);
  exit.group.position.set(cellCX(exit.cell.i), 0, cellCX(exit.cell.j));
  exit.group.visible = true;
  exit.active = true;
  exitSound();
  hud.flash('🚪 היציאה נפתחה! רוצו!', { good: true, dur: 1600 });
  juice.shake(0.2);
}

// ---------- Little dino brains: graze, then RUN ----------
function dinoDecide(d) {
  const opts = openNeighborCells(d.cell.i, d.cell.j);
  if (!opts.length) { d.next = { ...d.cell }; return; }
  const px = player.group.position.x, pz = player.group.position.z;
  const dx = d.group.position.x - px, dz = d.group.position.z - pz;
  const fleeing = dx * dx + dz * dz < 64;
  let best = null, bestScore = -Infinity;
  for (const [ni, nj] of opts) {
    const isRev = ni === d.prev.i && nj === d.prev.j;
    let sc;
    if (fleeing) sc = Math.hypot(cellCX(ni) - px, cellCX(nj) - pz) + Math.random() * 1.5 - (isRev ? 0.5 : 0);
    else {
      const straight = ni - d.cell.i === d.cell.i - d.prev.i && nj - d.cell.j === d.cell.j - d.prev.j;
      sc = Math.random() * 2 + (straight ? 1.6 : 0) - (isRev ? 3 : 0);
    }
    if (sc > bestScore) { bestScore = sc; best = [ni, nj]; }
  }
  d.prev = { ...d.cell };
  d.next = { i: best[0], j: best[1] };
}
function dinoStep(d, dt) {
  const px = player.group.position.x, pz = player.group.position.z;
  const distP = Math.hypot(d.group.position.x - px, d.group.position.z - pz);
  const fleeing = distP < 8 && state.phase === 'play';
  const spd = fleeing ? DINO_SPEED : DINO_SPEED * 0.5;
  d.swapCd = Math.max(0, d.swapCd - dt);
  d.popT = Math.min(1, d.popT + dt * 3.5);
  d.group.scale.setScalar(0.4 + 0.6 * d.popT);
  if (fleeing && d.swapCd <= 0 && distP < 5) {
    const dNext = Math.hypot(cellCX(d.next.i) - px, cellCX(d.next.j) - pz);
    const dCell = Math.hypot(cellCX(d.cell.i) - px, cellCX(d.cell.j) - pz);
    if (dNext < dCell - 0.5) {
      const tmp = d.cell; d.cell = d.next; d.next = tmp;
      d.prev = { ...d.cell };
      d.swapCd = 0.7;
    }
  }
  const tx = cellCX(d.next.i), tz = cellCX(d.next.j);
  const mx = tx - d.group.position.x, mz = tz - d.group.position.z;
  const dist = Math.hypot(mx, mz);
  const step = spd * dt;
  if (dist <= step) {
    d.group.position.x = tx;
    d.group.position.z = tz;
    d.cell = { ...d.next };
    dinoDecide(d);
  } else {
    d.group.position.x += (mx / dist) * step;
    d.group.position.z += (mz / dist) * step;
    d.yaw += angleDiff(Math.atan2(mx, mz), d.yaw) * smooth(10, dt);
    d.group.rotation.y = d.yaw;
  }
  d.hopPhase += spd * dt * (fleeing ? 2.1 : 1.2);
  d.group.position.y = Math.abs(Math.sin(d.hopPhase)) * (fleeing ? 0.24 : 0.1);
  if (distP > 60) placeDino(d, 7, 10);
}

// ---------- Dragon brain: BFS through the maze, straight at you ----------
const keyOf = (i, j) => i + ',' + j;
function bfsNextCell(si, sj, ti, tj) {
  if (si === ti && sj === tj) return null;
  const visited = new Map();
  const q = [[si, sj]];
  visited.set(keyOf(si, sj), null);
  let found = false;
  for (let qi = 0; qi < q.length; qi++) {
    const [ci, cj] = q[qi];
    for (const [ni, nj] of openNeighborCells(ci, cj)) {
      if (Math.abs(ni - si) > 16 || Math.abs(nj - sj) > 16) continue;
      const k = keyOf(ni, nj);
      if (visited.has(k)) continue;
      visited.set(k, keyOf(ci, cj));
      if (ni === ti && nj === tj) { found = true; break; }
      if (q.length < 750) q.push([ni, nj]);
    }
    if (found) break;
  }
  if (!found) return null;
  let cur = keyOf(ti, tj);
  const startK = keyOf(si, sj);
  while (visited.get(cur) !== startK) cur = visited.get(cur);
  const [ni, nj] = cur.split(',').map(Number);
  return { i: ni, j: nj };
}
function dragonDecide(d) {
  if (state.phase === 'play') {
    const pi = cellOf(player.group.position.x), pj = cellOf(player.group.position.z);
    const next = bfsNextCell(d.cell.i, d.cell.j, pi, pj);
    if (next) { d.prev = { ...d.cell }; d.next = next; return; }
  }
  const opts = openNeighborCells(d.cell.i, d.cell.j);
  if (!opts.length) { d.next = { ...d.cell }; return; }
  let best = opts[0], bestScore = -Infinity;
  for (const [ni, nj] of opts) {
    const isRev = ni === d.prev.i && nj === d.prev.j;
    const sc = Math.random() * 2 - (isRev ? 2.5 : 0) +
      (state.phase === 'play' ? -Math.hypot(cellCX(ni) - player.group.position.x, cellCX(nj) - player.group.position.z) * 0.2 : 0);
    if (sc > bestScore) { bestScore = sc; best = [ni, nj]; }
  }
  d.prev = { ...d.cell };
  d.next = { i: best[0], j: best[1] };
}

const Y_AXIS = new THREE.Vector3(0, 1, 0);
const _mouth = new THREE.Vector3();
const _v = new THREE.Vector3();
function dragonMouth(d, out) {
  out.set(0, 0, 2.0).applyAxisAngle(Y_AXIS, d.yaw);
  out.x += d.group.position.x;
  out.z += d.group.position.z;
  out.y = 1.7;
  return out;
}
const dragonSpeed = (d) => DRAGON_SPEED * (1 + d.returns * 0.12) * (state.overtime ? 1.5 : 1);
const dragonTargetable = (d) => d.phase !== 'down' && d.phase !== 'gone';

function dragonStep(d, dt) {
  const g = d.group;
  d.flap += dt * (d.phase === 'charge' || d.phase === 'breath' ? 16 : 9);
  const flapA = Math.sin(d.flap) * 0.45;
  d.wings[0].rotation.y = -flapA;
  d.wings[1].rotation.y = flapA;
  d.hitFlash = Math.max(0, d.hitFlash - dt * 4);
  d.mats.forEach((m) => m.emissive.setRGB(d.hitFlash, d.hitFlash * 0.85, d.hitFlash * 0.7));
  d.pips.position.set(g.position.x, 0, g.position.z);
  d.pips.visible = dragonTargetable(d) && state.phase === 'play';
  d.pips.children.forEach((pip, ix) => { pip.visible = ix < d.hp; });

  const px = player.group.position.x, pz = player.group.position.z;
  const distP = Math.hypot(g.position.x - px, g.position.z - pz);

  if (d.phase === 'down') {
    d.downT += dt;
    g.rotation.y += dt * 14;
    const s = Math.max(0.05, 1 - d.downT * 0.95);
    g.scale.setScalar(s);
    g.position.y = Math.abs(Math.sin(d.downT * 9)) * 0.8 * s;
    if (d.downT > 1.0) {
      d.phase = 'gone';
      d.goneT = 6;
      g.visible = false;
      spawnPuff(g.position.x, g.position.z, true, 2.2);
    }
    return;
  }
  if (d.phase === 'gone') {
    d.goneT -= dt;
    if (d.goneT <= 0 && state.phase === 'play') {
      d.phase = 'chase';
      d.hp = DRAGON_HP;
      d.fireCd = 2.2;
      d.returns += 1;
      g.visible = true;
      g.scale.setScalar(1);
      g.rotation.set(0, d.yaw, 0);
      g.position.y = 0;
      placeDragon(d, 9, 12);
      dragonDecide(d);
      roarSound();
      hud.flash(d.returns > 1 ? '🐉 הדרקון חזר, ועוד יותר מהיר!' : '🐉 הדרקון חזר!', { bad: true, dur: 900 });
    }
    return;
  }
  if (d.phase === 'stun') {
    d.stunT -= dt;
    g.position.y = Math.abs(Math.sin(d.stunT * 22)) * 0.15;
    if (d.stunT <= 0) { d.phase = 'chase'; d.fireCd = Math.max(d.fireCd, 1.2); g.position.y = 0; }
    return;
  }
  if (d.phase === 'charge') {
    d.chargeT += dt;
    d.yaw += angleDiff(Math.atan2(px - g.position.x, pz - g.position.z), d.yaw) * smooth(6, dt);
    g.rotation.y = d.yaw + Math.sin(d.chargeT * 40) * 0.04;
    d.glow.visible = true;
    d.glow.scale.setScalar(0.4 + (d.chargeT / CHARGE_T) * 1.3);
    if (d.chargeT >= CHARGE_T) {
      d.phase = 'breath';
      d.breathT = 0;
      d.glow.visible = false;
      dragonMouth(d, _mouth);
      const dx = px - _mouth.x, dz = pz - _mouth.z;
      const len = Math.hypot(dx, dz) || 1;
      d.aimX = dx / len;
      d.aimZ = dz / len;
      d.reach = marchReach(_mouth.x, _mouth.z, d.aimX, d.aimZ, FIRE_RANGE + 2);
      breathSound();
      juice.shake(0.15);
    }
    return;
  }
  if (d.phase === 'breath') {
    d.breathT += dt;
    dragonMouth(d, _mouth);
    const front = Math.min(d.breathT / 0.35, 1) * d.reach;
    state.flameEmit += dt * 65;
    while (state.flameEmit > 1) {
      state.flameEmit -= 1;
      const t = Math.random() * front;
      spawnPuff(_mouth.x + d.aimX * t + (Math.random() - 0.5) * 0.5, _mouth.z + d.aimZ * t + (Math.random() - 0.5) * 0.5, false, 0.7 + t * 0.12, d.aimX * 2.5, d.aimZ * 2.5);
    }
    if (state.phase === 'play') {
      const dd = distToSegXZ(px, pz, _mouth.x, _mouth.z, _mouth.x + d.aimX * front, _mouth.z + d.aimZ * front);
      if (dd < FIRE_R && losClear(_mouth.x, _mouth.z, px, pz)) die();
    }
    if (d.breathT >= BREATH_T) {
      d.phase = 'chase';
      d.fireCd = (2.4 + Math.random() * 1.4) * (state.overtime ? 0.6 : 1);
    }
    return;
  }

  // ---- chase ----
  const spd = state.phase === 'play' ? dragonSpeed(d) : DRAGON_SPEED * 0.45;
  const tx = cellCX(d.next.i), tz = cellCX(d.next.j);
  const mx = tx - g.position.x, mz = tz - g.position.z;
  const dist = Math.hypot(mx, mz);
  const step = spd * dt;
  if (dist <= step) {
    g.position.x = tx;
    g.position.z = tz;
    d.cell = { ...d.next };
    dragonDecide(d);
  } else {
    g.position.x += (mx / dist) * step;
    g.position.z += (mz / dist) * step;
    d.yaw += angleDiff(Math.atan2(mx, mz), d.yaw) * smooth(8, dt);
  }
  g.rotation.y = d.yaw;
  g.position.y = Math.abs(Math.sin(d.flap * 0.5)) * 0.12;

  if (state.phase === 'play') {
    if (distP > 55) { placeDragon(d, 10, 12); dragonDecide(d); }
    if (distP < 2.1 && distP > 0.01) { // don't body-block: shove the player gently aside
      const push = 2.1 - distP;
      player.group.position.x += ((px - g.position.x) / distP) * push;
      player.group.position.z += ((pz - g.position.z) / distP) * push;
    }
    d.fireCd -= dt;
    if (d.fireCd <= 0 && distP < FIRE_RANGE) {
      dragonMouth(d, _mouth);
      if (losClear(_mouth.x, _mouth.z, px, pz)) {
        d.phase = 'charge';
        d.chargeT = 0;
        chargeSound();
        if (state.chargeWarned < 2) { state.chargeWarned++; hud.flash('🔥 זהירות!', { bad: true, dur: 800 }); }
      } else {
        d.fireCd = 0.25;
      }
    }
  }
}

function nearestDragon(x, z) {
  let best = null, bd = Infinity;
  for (const d of dragons) {
    if (!dragonTargetable(d)) continue;
    const dd = Math.hypot(d.group.position.x - x, d.group.position.z - z);
    if (dd < bd) { bd = dd; best = d; }
  }
  return { d: best, dist: bd };
}

// ---------- Shooting ----------
function fireShot() {
  const s = shotPool.find((q) => !q.active) || shotPool[0];
  s.active = true;
  s.group.visible = true;
  s.life = 1.4;
  const yaw = player.group.rotation.y;
  let dx = Math.sin(yaw), dz = Math.cos(yaw);
  const mx = player.group.position.x + dx * 1.5;
  const mz = player.group.position.z + dz * 1.5;
  const { d, dist } = nearestDragon(mx, mz);
  if (d && dist < 16) { // generous auto-aim: this is for kids
    dx = (d.group.position.x - mx) / dist;
    dz = (d.group.position.z - mz) / dist;
  }
  s.group.position.set(mx, 1.0, mz);
  s.vx = dx * SHOT_SPEED;
  s.vz = dz * SHOT_SPEED;
  shootSound();
  player.jawT = 1;
  poofStars(mx, 1.0, mz, 2);
}
function updateShots(dt) {
  for (const s of shotPool) {
    if (!s.active) continue;
    s.life -= dt;
    const { d, dist } = nearestDragon(s.group.position.x, s.group.position.z);
    if (d && dist < 18) { // gentle homing so young trigger fingers still land the hit
      const cur = Math.atan2(s.vx, s.vz);
      const want = Math.atan2(d.group.position.x - s.group.position.x, d.group.position.z - s.group.position.z);
      const a = cur + clamp(angleDiff(want, cur), -4.2 * dt, 4.2 * dt);
      s.vx = Math.sin(a) * SHOT_SPEED;
      s.vz = Math.cos(a) * SHOT_SPEED;
    }
    s.group.position.x += s.vx * dt;
    s.group.position.z += s.vz * dt;
    s.star.rotation.z += dt * 14;
    let dead = s.life <= 0;
    if (!dead && pointBlocked(s.group.position.x, s.group.position.z, 0.12)) {
      poofStars(s.group.position.x, 0.9, s.group.position.z, 3);
      dead = true;
    }
    if (!dead && d && dist < 1.7) {
      dead = true;
      dragonHit(d);
      poofStars(s.group.position.x, 1.2, s.group.position.z, 6);
    }
    if (dead) { s.active = false; s.group.visible = false; }
  }
}
function dragonHit(d) {
  d.hp -= 1;
  d.hitFlash = 1;
  d.glow.visible = false;
  state.score += 20;
  hitSound();
  juice.shake(0.2);
  juice.pop(_v.set(d.group.position.x, 2.5, d.group.position.z), '+20', { color: '#b8321f', size: 26 });
  if (d.hp <= 0) {
    d.phase = 'down';
    d.downT = 0;
    state.score += 100;
    state.dragonsDown += 1;
    downSound();
    juice.hitstop(0.08);
    hud.flash('💨 הדרקון ברח! ‎+100');
  } else {
    d.phase = 'stun';
    d.stunT = 0.55;
  }
}

// ---------- Eat, exit, die, win ----------
function eatCheck() {
  for (const d of dinos) {
    const dd = Math.hypot(d.group.position.x - player.group.position.x, d.group.position.z - player.group.position.z);
    if (dd >= EAT_DIST) continue;
    state.combo = state.boostT > 0 ? state.combo + 1 : 1;
    state.boostT = BOOST_T;
    const pts = Math.min(30, 10 + (state.combo - 1) * 5);
    state.score += pts;
    state.eaten += 1;
    setScore();
    chompSound();
    if (state.combo > 1) comboSound(state.combo);
    juice.hitstop(0.04);
    juice.bounce(player.group, 0.25);
    juice.pop(_v.set(d.group.position.x, 1.6, d.group.position.z), state.combo > 1 ? `x${state.combo} 🍖 +${pts}` : `+${pts}`, { color: '#2f8a25', size: state.combo > 1 ? 34 : 28 });
    if (state.combo === 3) hud.flash('שרשרת! ⚡', { good: true, dur: 700 });
    if (state.combo >= 5) hud.flash('יאמי!!! 🍖🍖🍖', { good: true, dur: 700 });
    player.jawT = 1;
    poofStars(d.group.position.x, 0.8, d.group.position.z, 5);
    placeDino(d, 7, 10);
    if (state.eaten === Math.ceil(GOAL_EAT / 2) && dragons.length < 2) {
      const d2 = makeDragon();
      placeDragon(d2, 9, 12);
      dragonDecide(d2);
      dragons.push(d2);
      roarSound();
      hud.flash('🐉🐉 עוד דרקון!', { bad: true, dur: 1200 });
      juice.shake(0.3);
    }
    if (state.eaten >= GOAL_EAT && !exit.active) openExit();
  }
}
function exitCheck() {
  if (!exit.active) return;
  exit.spin += 0.016;
  exit.door.rotation.z = exit.spin;
  const dd = Math.hypot(exit.group.position.x - player.group.position.x, exit.group.position.z - player.group.position.z);
  if (dd < EXIT_DIST) win();
}
function die() {
  if (state.phase !== 'play') return;
  state.phase = 'dead';
  state.deathT = 0;
  deathSound();
  juice.shake(0.6);
  juice.hitstop(0.12, 0.1);
  hud.flash('נשרפתם! 🔥', { bad: true, dur: 1300 });
  player.mats.forEach((m) => m.color.setHex(0x4a4038));
}
function win() {
  if (state.phase !== 'play') return;
  state.phase = 'win';
  state.winT = 0;
  const left = Math.max(0, ROUND_TIME - state.t);
  const bonus = Math.round(left) * 2;
  state.score += bonus;
  winSound();
  juice.shake(0.3);
  hud.flash(bonus > 0 ? `🏆 ברחתם! ‎+${bonus} על הזמן` : '🏆 ברחתם!!', { good: true, dur: 1800 });
  for (const d of dragons) if (d.phase !== 'gone') { d.phase = 'down'; d.downT = 0; }
}
function showOver(won) {
  state.phase = 'over';
  hud.stopMusic();
  hud.set('#goTitle', won ? '🏆 יצאתם מהמבוך!! 🦖' : '🔥 הדרקון שרף אתכם!');
  hud.set('#finalScore', `${state.score} נקודות!`);
  hud.set('#finalDetail', `אכלתם ${state.eaten} דינוזאורים 🍖 · ${state.dragonsDown} פעמים הבריחו את הדרקון 🐉 · ${Math.min(ROUND_TIME, state.t).toFixed(0)} שניות`);
  const best = hud.best('dino-best', state.score);
  hud.set('#bestScore', `השיא שלכם: ${best} נקודות ⭐`);
  hud.show('#gameover');
}

// ---------- Flow ----------
function startGame() {
  SEED = (Math.random() * 0xffffffff) | 0;
  Object.assign(state, { phase: 'play', t: 0, score: 0, eaten: 0, combo: 0, boostT: 0, dragonsDown: 0, shotCd: 0, chargeWarned: 0, lastTickSec: -1, overtime: false });
  state.vel.set(0, 0, 0);
  player.group.position.set(cellCX(0), 0, cellCX(0));
  player.group.rotation.set(0, 0, 0);
  player.group.scale.setScalar(1);
  player.jawT = 0;
  player.mats.forEach((m, ix) => m.color.setHex(player.origColors[ix]));
  // back to one dragon
  while (dragons.length > 1) {
    const d = dragons.pop();
    scene.remove(d.group);
    scene.remove(d.pips);
    d.arrow.remove();
  }
  for (const d of dragons) {
    Object.assign(d, { phase: 'chase', hp: DRAGON_HP, fireCd: 3, hitFlash: 0, returns: 0 });
    d.group.visible = true;
    d.group.scale.setScalar(1);
    d.group.rotation.set(0, 0, 0);
    d.group.position.y = 0;
    d.glow.visible = false;
    placeDragon(d, 8, 10);
    dragonDecide(d);
  }
  exit.active = false;
  exit.group.visible = false;
  dinos.forEach((d, ix) => placeDino(d, 3 + (ix % 3), 6));
  puffPool.forEach((p) => { p.active = false; p.mesh.visible = false; });
  starPool.forEach((s) => { s.active = false; s.mesh.visible = false; });
  shotPool.forEach((s) => { s.active = false; s.group.visible = false; });
  hud.set('#timer', `⏱️ ${ROUND_TIME}`);
  document.getElementById('timer').classList.remove('low');
  hud.set('#score', `🍖 0/${GOAL_EAT}`);
  hud.hide('#intro');
  hud.hide('#gameover');
  hud.startMusic();
  rebuildWalls(true);
  roarSound();
  hud.flash('🦖 לתפוס אותם!', { dur: 1100 });
}
hud.bind({ start: startGame, restart: startGame });

// ---------- Main loop ----------
const _cam = new THREE.Vector3();
const _look = new THREE.Vector3(cellCX(0), 0, cellCX(0));
const _proj = new THREE.Vector3();
const _axis = { x: 0, z: 0 };

function updatePools(dt) {
  for (const p of puffPool) {
    if (!p.active) continue;
    p.life += dt;
    const f = p.life / p.maxLife;
    if (f >= 1) { p.active = false; p.mesh.visible = false; continue; }
    p.mesh.position.x += p.vx * dt;
    p.mesh.position.z += p.vz * dt;
    p.mesh.scale.multiplyScalar(1 + p.grow * dt);
    p.mesh.material.opacity = 0.95 * (1 - f);
  }
  for (const s of starPool) {
    if (!s.active) continue;
    s.life += dt;
    const f = s.life / s.maxLife;
    if (f >= 1) { s.active = false; s.mesh.visible = false; continue; }
    s.vy -= 9 * dt;
    s.mesh.position.x += s.vx * dt;
    s.mesh.position.y = Math.max(0.1, s.mesh.position.y + s.vy * dt);
    s.mesh.position.z += s.vz * dt;
    s.mesh.rotation.z += s.spin * dt;
    s.mesh.material.opacity = 1 - f * f;
  }
}

// an emoji on the screen edge pointing at something off screen
function placeArrow(el, worldPos, charging) {
  _proj.copy(worldPos).setY(1).project(camera);
  const off = Math.abs(_proj.x) > 0.92 || Math.abs(_proj.y) > 0.92;
  if (!off) { el.style.display = 'none'; return; }
  const cx = clamp(_proj.x, -0.92, 0.92), cy = clamp(_proj.y, -0.88, 0.76);
  el.style.display = 'block';
  el.style.left = `${(cx * 0.5 + 0.5) * window.innerWidth}px`;
  el.style.top = `${(-cy * 0.5 + 0.5) * window.innerHeight}px`;
  el.classList.toggle('charging', !!charging);
}

function update(dt) {
  const p = player.group;
  if (state.phase === 'play') {
    state.t += dt;
    const left = Math.max(0, ROUND_TIME - state.t);
    hud.set('#timer', `⏱️ ${Math.ceil(left)}`);
    if (left < 30) document.getElementById('timer').classList.add('low');
    if (left < 10 && left > 0 && Math.ceil(left) !== state.lastTickSec) { state.lastTickSec = Math.ceil(left); tickSound(); }
    if (left <= 0 && !state.overtime) {
      state.overtime = true;
      roarSound();
      juice.shake(0.4);
      hud.flash('‼️ הדרקונים מתעצבנים!', { bad: true, dur: 1600 });
    }

    // --- you, the apex predator ---
    const ax = input.p1.axis(_axis);
    state.boostT = Math.max(0, state.boostT - dt);
    if (state.boostT <= 0) state.combo = 0;
    const speed = PLAYER_SPEED * (state.boostT > 0 ? BOOST_MUL : 1);
    _v.set(ax.x, 0, ax.z).multiplyScalar(speed);
    state.vel.lerp(_v, smooth(12, dt));
    p.position.x += state.vel.x * dt;
    p.position.z += state.vel.z * dt;
    collideWalls(p.position, 0.8);
    const moving = state.vel.length() > 1;
    if (moving) {
      state.runPhase += state.vel.length() * dt * 1.5;
      p.rotation.y += angleDiff(Math.atan2(state.vel.x, state.vel.z), p.rotation.y) * smooth(10, dt);
    }
    p.position.y = moving ? Math.abs(Math.sin(state.runPhase)) * 0.14 : 0;
    player.legs[0].rotation.x = moving ? Math.sin(state.runPhase) * 0.9 : 0;
    player.legs[1].rotation.x = moving ? -Math.sin(state.runPhase) * 0.9 : 0;
    player.tail.rotation.y = Math.sin(state.runPhase * 0.7) * 0.18;
    player.shadow.position.y = 0.03 - p.position.y;
    if (state.boostT > 0 && moving && Math.random() < 0.35) poofStars(p.position.x, 0.4, p.position.z - 1.2, 1); // sprint sparkles
    player.jawT = Math.max(0, (player.jawT || 0) - dt * 3.2);
    player.jaw.rotation.x = Math.sin(Math.min(1, player.jawT) * Math.PI) * 0.65;

    state.shotCd -= dt;
    if (input.p1.down('a') && state.shotCd <= 0) { state.shotCd = SHOT_CD; fireShot(); }

    eatCheck();
    exitCheck();
    dinos.forEach((d) => dinoStep(d, dt));
    dragons.forEach((d) => dragonStep(d, dt));
    updateShots(dt);
    rebuildWalls();
  } else if (state.phase === 'idle') {
    state.t += dt;
    dinos.forEach((d) => dinoStep(d, dt));
    dragons.forEach((d) => dragonStep(d, dt));
    p.position.y = Math.abs(Math.sin(state.t * 2.5)) * 0.1;
  } else if (state.phase === 'dead') {
    state.deathT += dt;
    p.rotation.z = Math.min(Math.PI / 2, state.deathT * 3);
    p.position.y = Math.abs(Math.sin(state.deathT * 6)) * 0.3 * Math.max(0, 1 - state.deathT);
    state.smokeEmit += dt * 14;
    while (state.smokeEmit > 1) {
      state.smokeEmit -= 1;
      spawnPuff(p.position.x + (Math.random() - 0.5), p.position.z + (Math.random() - 0.5), true, 1.1);
    }
    dragons.forEach((d) => dragonStep(d, dt));
    if (state.deathT > 1.5) showOver(false);
  } else if (state.phase === 'win') {
    state.winT += dt;
    p.rotation.y += dt * 7;
    p.position.y = Math.abs(Math.sin(state.winT * 8)) * 0.5;
    if (state.winT < 1.2 && Math.random() < 0.3) poofStars(p.position.x + (Math.random() - 0.5) * 6, 2.5, p.position.z + (Math.random() - 0.5) * 6, 2, true);
    dinos.forEach((d) => dinoStep(d, dt));
    dragons.forEach((d) => dragonStep(d, dt));
    if (state.winT > 1.9) showOver(true);
  }

  updatePools(dt);

  // --- camera: straight down at the maze, drifting after you ---
  if (state.phase === 'idle') {
    _cam.set(cellCX(0) + Math.sin(state.t * 0.12) * 5, 27, cellCX(0) + 10 + Math.cos(state.t * 0.12) * 4);
    camera.position.lerp(_cam, smooth(1.5, dt));
    _look.lerp(_v.set(cellCX(0), 0, cellCX(0)), smooth(2, dt));
  } else {
    _cam.set(p.position.x + state.vel.x * 0.22, 29, p.position.z + state.vel.z * 0.22 + 10.5);
    camera.position.lerp(_cam, smooth(4, dt));
    _look.lerp(_v.set(p.position.x + state.vel.x * 0.22, 0, p.position.z + state.vel.z * 0.22), smooth(4, dt));
  }
  camera.lookAt(_look);
  floor.position.x = Math.round(p.position.x / FLOOR_SNAP) * FLOOR_SNAP;
  floor.position.z = Math.round(p.position.z / FLOOR_SNAP) * FLOOR_SNAP;

  // --- compasses: dragons and the exit on the screen edge ---
  const showArrows = state.phase === 'play';
  for (const d of dragons) {
    if (showArrows && dragonTargetable(d)) placeArrow(d.arrow, d.group.position, d.phase === 'charge' || d.phase === 'breath');
    else d.arrow.style.display = 'none';
  }
  if (showArrows && exit.active) placeArrow(exit.arrow, exit.group.position, false);
  else exit.arrow.style.display = 'none';
}

// set the idle scene
placeDragon(dragons[0], 4, 6);
dragonDecide(dragons[0]);
dinos.forEach((d) => placeDino(d, 2, 4));
rebuildWalls(true);
app.start(update);

// debugging / test hook
window.__dino = {
  app, state, player, dragons, dinos, exit,
  startGame, losClear, pointBlocked, cellCX, cellOf, openX, openZ, placeDragon, fireShot, die, win, openExit,
  step: (dt) => app.step(dt),
  render: () => app.frame(0),
};
