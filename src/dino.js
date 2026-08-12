import * as THREE from 'three';

// ---------- Marker palette (same paper world as the other games) ----------
const PAPER = 0xf8f5ec;
const TREX_GREEN = 0x4a9c3d;
const TREX_DARK = 0x1f5c17;
const TREX_JAW = 0x3c8030;
const DRAGON_RED = 0xc9342a;
const DRAGON_DARK = 0x6e120b;
const WALL_BROWN = 0x6b4e30;
const INK = 0x2a2118;

// ---------- The kid's spec ----------
// speeds on a 1-10 scale: little dinos 5, dragon 4, and you get 6 so the
// chase works both ways. one speed point = 1.3 world units per second.
const SPD = 1.3;
const PLAYER_SPEED = 6 * SPD;
const DINO_SPEED = 5 * SPD;
const DRAGON_SPEED = 4 * SPD;
const WIN_TIME = 200;          // survive this many seconds
const DINO_COUNT = 7;
const EAT_DIST = 1.7;
const DRAGON_HP = 3;
const FIRE_RANGE = 11;
const CHARGE_T = 0.85;         // the dragon inhales... (your warning)
const BREATH_T = 0.95;         // ...and breathes
const FIRE_R = 1.05;           // flame stream thickness
const SHOT_CD = 0.45;
const SHOT_SPEED = 16;

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

// binary-tree maze: every cell carves north OR east, so every cell always has
// a way out and the whole infinite thing stays connected. computed from the
// hash alone — no chunk storage, the maze just *is*, forever, in every direction.
const inPlaza = (i, j) => Math.abs(i) <= 1 && Math.abs(j) <= 1;
const carveN = (i, j) => h2(i, j, 1) < 0.5;
function openZ(i, j) { // passage between (i,j) and (i,j+1)
  if (inPlaza(i, j) && inPlaza(i, j + 1)) return true;
  return carveN(i, j) || h2(i, j, 2) < LOOP_P;
}
function openX(i, j) { // passage between (i,j) and (i+1,j)
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

// circle vs the walls of the 3x3 cells around it
function pushOutBox(pos, r, x0, x1, z0, z1) {
  const cx = Math.max(x0, Math.min(pos.x, x1));
  const cz = Math.max(z0, Math.min(pos.z, z1));
  let dx = pos.x - cx, dz = pos.z - cz;
  const d2 = dx * dx + dz * dz;
  if (d2 >= r * r) return;
  if (d2 > 1e-9) {
    const d = Math.sqrt(d2);
    pos.x += (dx / d) * (r - d);
    pos.z += (dz / d) * (r - d);
  } else {
    // dead center inside a wall: escape through the nearest face
    const exits = [
      [pos.x - x0 + r, -1, 0], [x1 - pos.x + r, 1, 0],
      [pos.z - z0 + r, 0, -1], [z1 - pos.z + r, 0, 1],
    ];
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
  for (let pass = 0; pass < 2; pass++) {
    forNearbyWalls(pos.x, pos.z, (x0, x1, z0, z1) => pushOutBox(pos, r, x0, x1, z0, z1));
  }
}

function pointBlocked(x, z, pad = 0.08) {
  let hit = false;
  forNearbyWalls(x, z, (x0, x1, z0, z1) => {
    if (x > x0 - pad && x < x1 + pad && z > z0 - pad && z < z1 + pad) hit = true;
  });
  return hit;
}

function losClear(ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const len = Math.hypot(dx, dz);
  if (len < 0.001) return true;
  const ux = dx / len, uz = dz / len;
  for (let t = 0.3; t < len; t += 0.3) {
    if (pointBlocked(ax + ux * t, az + uz * t, 0.02)) return false;
  }
  return true;
}

// how far a flame travels before a wall eats it
function marchReach(ax, az, ux, uz, maxLen) {
  for (let t = 0.4; t < maxLen; t += 0.3) {
    if (pointBlocked(ax + ux * t, az + uz * t, 0.1)) return t;
  }
  return maxLen;
}

function distToSegXZ(px, pz, ax, az, bx, bz) {
  const abx = bx - ax, abz = bz - az;
  const l2 = abx * abx + abz * abz;
  let t = l2 > 1e-9 ? ((px - ax) * abx + (pz - az) * abz) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + abx * t), pz - (az + abz * t));
}

// ---------- Renderer / scene ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.getElementById('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(PAPER);

const camera = new THREE.PerspectiveCamera(46, window.innerWidth / window.innerHeight, 0.1, 300);
camera.position.set(cellCX(0), 29, cellCX(0) + 10.5);
camera.lookAt(cellCX(0), 0, cellCX(0));

scene.add(new THREE.HemisphereLight(0xffffff, 0xcfc4a8, 1.4));
const sun = new THREE.DirectionalLight(0xfff4e0, 1.2);
sun.position.set(8, 25, 14);
scene.add(sun);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------- Materials & helpers ----------
const gradientMap = new THREE.DataTexture(new Uint8Array([110, 190, 255]), 3, 1, THREE.RedFormat);
gradientMap.minFilter = gradientMap.magFilter = THREE.NearestFilter;
gradientMap.needsUpdate = true;

const flat = (color) => new THREE.MeshBasicMaterial({ color });
const toon = (color) => new THREE.MeshToonMaterial({ color, gradientMap });

function outline(mesh, color, scale = 1.07) {
  const shell = new THREE.Mesh(mesh.geometry, new THREE.MeshBasicMaterial({ color, side: THREE.BackSide }));
  shell.scale.setScalar(scale);
  mesh.add(shell);
  return mesh;
}

function makeShadow(radius) {
  const s = new THREE.Mesh(
    new THREE.CircleGeometry(radius, 20),
    new THREE.MeshBasicMaterial({ color: 0xd6cdb9, transparent: true, opacity: 0.6 })
  );
  s.rotation.x = -Math.PI / 2;
  s.position.y = 0.03;
  return s;
}

// ---------- Hand-drawn textures ----------
function canvasTex(size, draw) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const groundTex = canvasTex(512, (g) => {
  g.fillStyle = '#f8f5ec';
  g.fillRect(0, 0, 512, 512);
  g.lineCap = 'round';
  // marker grass tufts
  for (let i = 0; i < 90; i++) {
    const x = Math.random() * 512, y = Math.random() * 512;
    g.strokeStyle = ['#86bb6a', '#6da653', '#9cc884'][i % 3];
    g.globalAlpha = 0.55;
    g.lineWidth = 3;
    for (let k = -1; k <= 1; k++) {
      g.beginPath();
      g.moveTo(x + k * 4, y);
      g.lineTo(x + k * 6, y - 8 - Math.random() * 5);
      g.stroke();
    }
  }
  // little pollen dots
  g.globalAlpha = 0.4;
  for (let i = 0; i < 40; i++) {
    g.fillStyle = ['#e8b62c', '#d95f9e', '#8fbf8a'][i % 3];
    g.beginPath();
    g.arc(Math.random() * 512, Math.random() * 512, 2.2, 0, Math.PI * 2);
    g.fill();
  }
  g.globalAlpha = 1;
});
groundTex.wrapS = groundTex.wrapT = THREE.RepeatWrapping;

const wallTex = canvasTex(256, (g) => {
  g.fillStyle = '#b99772';
  g.fillRect(0, 0, 256, 256);
  g.lineCap = 'round';
  // marker cross-hatch, like the walls were scribbled in
  g.strokeStyle = '#8f6f4e';
  g.globalAlpha = 0.45;
  g.lineWidth = 4;
  for (let i = 0; i < 42; i++) {
    const x = Math.random() * 256, y = Math.random() * 256, l = 14 + Math.random() * 22;
    const a = (Math.random() < 0.5 ? 1 : -1) * (0.6 + Math.random() * 0.3);
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
    g.stroke();
  }
  g.globalAlpha = 0.25;
  g.fillStyle = '#a5825e';
  for (let i = 0; i < 14; i++) {
    g.beginPath();
    g.arc(Math.random() * 256, Math.random() * 256, 10 + Math.random() * 16, 0, Math.PI * 2);
    g.fill();
  }
  g.globalAlpha = 1;
});
wallTex.wrapS = wallTex.wrapT = THREE.RepeatWrapping;

const flameTex = canvasTex(128, (g) => {
  const blob = (r, color, n, spread) => {
    g.fillStyle = color;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      g.beginPath();
      g.arc(64 + Math.cos(a) * spread, 64 + Math.sin(a) * spread, r, 0, Math.PI * 2);
      g.fill();
    }
  };
  blob(26, '#e8481c', 7, 22);
  blob(24, '#ff8c1f', 6, 12);
  g.fillStyle = '#ffd23e';
  g.beginPath();
  g.arc(64, 64, 24, 0, Math.PI * 2);
  g.fill();
});

const smokeTex = canvasTex(128, (g) => {
  const grays = ['#9a938a', '#b5aca0', '#847d73'];
  for (let i = 0; i < 9; i++) {
    g.fillStyle = grays[i % 3];
    const a = (i / 9) * Math.PI * 2;
    g.beginPath();
    g.arc(64 + Math.cos(a) * 16, 64 + Math.sin(a) * 16, 24, 0, Math.PI * 2);
    g.fill();
  }
});

function starTex(fill, stroke) {
  return canvasTex(128, (g) => {
    g.fillStyle = fill;
    g.strokeStyle = stroke;
    g.lineWidth = 7;
    g.lineJoin = 'round';
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? 56 : 26;
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const x = 64 + Math.cos(a) * r, y = 64 + Math.sin(a) * r;
      i === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
    }
    g.closePath();
    g.fill();
    g.stroke();
  });
}
const starTexs = [starTex('#ffd23e', '#c98f0e'), starTex('#7ed957', '#2f8a25'), starTex('#ff8bb3', '#c2417a'), starTex('#fff8e0', '#c98f0e')];

const wingTex = canvasTex(128, (g) => {
  g.fillStyle = '#ef8a63';
  g.strokeStyle = '#6e120b';
  g.lineWidth = 6;
  g.lineJoin = 'round';
  g.beginPath();
  g.moveTo(8, 96);
  g.quadraticCurveTo(30, 10, 122, 12);
  g.quadraticCurveTo(104, 48, 96, 88);
  g.quadraticCurveTo(74, 74, 62, 96);
  g.quadraticCurveTo(40, 78, 8, 96);
  g.closePath();
  g.fill();
  g.stroke();
  // wing ribs
  g.lineWidth = 4;
  [[100, 30], [76, 46], [48, 66]].forEach(([x, y]) => {
    g.beginPath();
    g.moveTo(14, 92);
    g.lineTo(x, y);
    g.stroke();
  });
});

const boneTex = canvasTex(96, (g) => {
  g.strokeStyle = '#b9a98a';
  g.fillStyle = '#efe9da';
  g.lineWidth = 5;
  g.save();
  g.translate(48, 48);
  g.rotate(0.6);
  g.beginPath();
  g.roundRect(-26, -6, 52, 12, 6);
  g.fill();
  g.stroke();
  [[-26, -8], [-26, 8], [26, -8], [26, 8]].forEach(([x, y]) => {
    g.beginPath();
    g.arc(x, y, 9, 0, Math.PI * 2);
    g.fill();
    g.stroke();
  });
  g.restore();
});

const flowerTex = canvasTex(96, (g) => {
  g.fillStyle = '#e78fbe';
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    g.beginPath();
    g.arc(48 + Math.cos(a) * 17, 48 + Math.sin(a) * 17, 13, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = '#ecc94d';
  g.beginPath();
  g.arc(48, 48, 12, 0, Math.PI * 2);
  g.fill();
});

const pebbleTex = canvasTex(96, (g) => {
  g.fillStyle = '#cdc4b2';
  g.strokeStyle = '#9a8f78';
  g.lineWidth = 5;
  [[30, 56, 16], [58, 50, 13], [46, 68, 10]].forEach(([x, y, r]) => {
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
    g.stroke();
  });
});

// ---------- The floor (an endless paper meadow that follows you) ----------
const FLOOR_SNAP = 15;
groundTex.repeat.set(16, 16);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(FLOOR_SNAP * 16, FLOOR_SNAP * 16), new THREE.MeshBasicMaterial({ map: groundTex }));
floor.rotation.x = -Math.PI / 2;
scene.add(floor);

// ---------- The walls (instanced, rebuilt as you roam) ----------
const MAXW = 520;
const wallGeoX = new THREE.BoxGeometry(CELL + WALL_T, WALL_H, WALL_T); // runs along x
const wallGeoZ = new THREE.BoxGeometry(WALL_T, WALL_H, CELL + WALL_T); // runs along z
const wallMat = new THREE.MeshToonMaterial({ color: 0xffffff, map: wallTex, gradientMap });
const wallOutMat = new THREE.MeshBasicMaterial({ color: WALL_BROWN, side: THREE.BackSide });
const wallsX = new THREE.InstancedMesh(wallGeoX, wallMat, MAXW);
const wallsZ = new THREE.InstancedMesh(wallGeoZ, wallMat, MAXW);
const wallsXOut = new THREE.InstancedMesh(wallGeoX, wallOutMat, MAXW);
const wallsZOut = new THREE.InstancedMesh(wallGeoZ, wallOutMat, MAXW);
[wallsX, wallsZ, wallsXOut, wallsZOut].forEach((m) => { m.frustumCulled = false; scene.add(m); });

const _m4 = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();
const outScaleX = new THREE.Vector3((CELL + WALL_T + 0.16) / (CELL + WALL_T), (WALL_H + 0.2) / WALL_H, (WALL_T + 0.16) / WALL_T);
const outScaleZ = new THREE.Vector3(outScaleX.z, outScaleX.y, outScaleX.x);

// flat doodads sprinkled through the maze so the endlessness feels alive
const DOODADS = 44;
const doodadPool = [];
for (let k = 0; k < DOODADS; k++) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: boneTex, transparent: true, depthWrite: false }));
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
      if (!openZ(i, j) && nx < MAXW) { // wall along x at the z edge
        _p.set(cellCX(i), WALL_H / 2, (j + 1) * CELL);
        _m4.compose(_p, _q, _s.set(1, 1, 1));
        wallsX.setMatrixAt(nx, _m4);
        _m4.compose(_p, _q, outScaleX);
        wallsXOut.setMatrixAt(nx, _m4);
        nx++;
      }
      if (!openX(i, j) && nz < MAXW) { // wall along z at the x edge
        _p.set((i + 1) * CELL, WALL_H / 2, cellCX(j));
        _m4.compose(_p, _q, _s.set(1, 1, 1));
        wallsZ.setMatrixAt(nz, _m4);
        _m4.compose(_p, _q, outScaleZ);
        wallsZOut.setMatrixAt(nz, _m4);
        nz++;
      }
      // a doodad?
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
  wallsXOut.instanceMatrix.needsUpdate = true;
  wallsZOut.instanceMatrix.needsUpdate = true;
}

// ---------- The big dino (that's you!) ----------
function makeTrex() {
  const g = new THREE.Group();
  const mats = [];
  const mat = (c) => { const m = toon(c); mats.push(m); return m; };

  const body = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), mat(TREX_GREEN));
  body.scale.set(0.95, 0.8, 1.25);
  body.position.y = 1.0;
  outline(body, TREX_DARK, 1.06);
  g.add(body);

  // spikes down the spine — this is what you see from above!
  for (let k = 0; k < 4; k++) {
    const sp = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.42, 6), mat(TREX_DARK));
    sp.position.set(0, 1.72 - k * 0.1, -0.1 - k * 0.42);
    sp.rotation.x = -0.5;
    g.add(sp);
  }

  const head = new THREE.Group();
  head.position.set(0, 1.62, 0.95);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.62, 18, 12), mat(TREX_GREEN));
  skull.scale.set(1, 0.85, 1.05);
  outline(skull, TREX_DARK, 1.07);
  head.add(skull);
  const snout = new THREE.Mesh(new THREE.SphereGeometry(0.4, 14, 10), mat(TREX_GREEN));
  snout.scale.set(0.85, 0.6, 1.05);
  snout.position.set(0, -0.12, 0.48);
  outline(snout, TREX_DARK, 1.08);
  head.add(snout);
  const jaw = new THREE.Group();
  jaw.position.set(0, -0.3, 0.1);
  const jawMesh = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.2, 0.85), mat(TREX_JAW));
  jawMesh.position.set(0, -0.1, 0.42);
  outline(jawMesh, TREX_DARK, 1.1);
  jaw.add(jawMesh);
  for (let k = -1; k <= 1; k++) {
    const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.16, 5), flat(0xffffff));
    tooth.position.set(k * 0.16, 0.06, 0.78);
    jaw.add(tooth);
  }
  head.add(jaw);
  [-1, 1].forEach((sx) => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 10), flat(0xffffff));
    eye.position.set(sx * 0.3, 0.3, 0.3);
    head.add(eye);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), flat(INK));
    pupil.position.set(sx * 0.32, 0.34, 0.43);
    head.add(pupil);
  });
  g.add(head);

  const tail = new THREE.Group();
  [[0.45, -1.15, 0.85], [0.32, -1.62, 0.72], [0.2, -2.0, 0.6]].forEach(([r, z, y]) => {
    const seg = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), mat(TREX_GREEN));
    seg.position.set(0, y, z);
    outline(seg, TREX_DARK, 1.09);
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

  const shadow = makeShadow(1.25);
  g.add(shadow);
  return { group: g, head, jaw, tail, legs, shadow, mats, origColors: mats.map((m) => m.color.getHex()) };
}

// ---------- The little dinos (lunch) ----------
const MINI_COLORS = [
  [0xe8862c, 0x9c5210], [0x2b9d97, 0x155a56], [0x8656c9, 0x4b2a7a],
  [0xd95f9e, 0x8f2f63], [0xd9b32c, 0x8a6d0e],
];
function makeMini(colorIx) {
  const [col, dark] = MINI_COLORS[colorIx % MINI_COLORS.length];
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 12), toon(col));
  body.scale.set(1, 0.92, 1.15);
  body.position.y = 0.55;
  outline(body, dark, 1.08);
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.36, 14, 10), toon(col));
  head.position.set(0, 1.0, 0.42);
  outline(head, dark, 1.09);
  g.add(head);
  const crest = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.26, 6), toon(dark));
  crest.position.set(0, 1.36, 0.3);
  g.add(crest);
  [-1, 1].forEach((sx) => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), flat(0xffffff));
    eye.position.set(sx * 0.18, 1.12, 0.62);
    g.add(eye);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), flat(INK));
    pupil.position.set(sx * 0.19, 1.13, 0.71);
    g.add(pupil);
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.2, 4, 6), toon(dark));
    leg.position.set(sx * 0.26, 0.2, 0);
    g.add(leg);
  });
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.55, 8), toon(col));
  tail.rotation.x = Math.PI / 2 + 0.55;
  tail.position.set(0, 0.5, -0.7);
  outline(tail, dark, 1.15);
  g.add(tail);
  g.add(makeShadow(0.62));
  return g;
}

// ---------- The dragon (uh oh) ----------
function makeDragon() {
  const g = new THREE.Group();
  const mats = [];
  const mat = (c) => { const m = toon(c); mats.push(m); return m; };

  const body = new THREE.Mesh(new THREE.SphereGeometry(1.05, 20, 14), mat(DRAGON_RED));
  body.scale.set(1, 0.9, 1.4);
  body.position.y = 1.15;
  outline(body, DRAGON_DARK, 1.06);
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
  outline(skull, DRAGON_DARK, 1.07);
  head.add(skull);
  const snout = new THREE.Mesh(new THREE.SphereGeometry(0.38, 14, 10), mat(DRAGON_RED));
  snout.scale.set(0.85, 0.6, 1.05);
  snout.position.set(0, -0.1, 0.5);
  outline(snout, DRAGON_DARK, 1.08);
  head.add(snout);
  [-1, 1].forEach((sx) => {
    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.45, 6), flat(0xf3ead4));
    horn.position.set(sx * 0.24, 0.48, -0.15);
    horn.rotation.x = -0.45;
    head.add(horn);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 10), flat(0xffe9a8));
    eye.position.set(sx * 0.28, 0.26, 0.32);
    head.add(eye);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), flat(INK));
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
    const wing = new THREE.Mesh(
      new THREE.PlaneGeometry(2.2, 1.55),
      new THREE.MeshBasicMaterial({ map: wingTex, transparent: true, side: THREE.DoubleSide })
    );
    wing.geometry.translate(1.1, 0, 0); // hinge at the root
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
    outline(seg, DRAGON_DARK, 1.09);
    tail.add(seg);
  });
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.5, 4), mat(DRAGON_DARK));
  tip.rotation.x = Math.PI / 2 + 2.6;
  tip.position.set(0, 0.78, -2.5);
  tail.add(tip);
  g.add(tail);

  // charge-up glow at the mouth
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: flameTex, transparent: true, depthWrite: false, opacity: 0.9 }));
  glow.rotation.x = -Math.PI / 2;
  glow.position.set(0, 1.7, 2.2);
  glow.renderOrder = 3;
  glow.visible = false;
  g.add(glow);

  g.add(makeShadow(1.5));
  return { group: g, head, wings, tail, glow, mats };
}

// hp pips floating over the dragon (not rotating with it)
const pipsGroup = new THREE.Group();
for (let k = 0; k < DRAGON_HP; k++) {
  const pip = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.55), new THREE.MeshBasicMaterial({ map: flameTex, transparent: true, depthWrite: false }));
  pip.rotation.x = -Math.PI / 2;
  pip.position.set((k - 1) * 0.7, 3.3, 0);
  pip.renderOrder = 3;
  pipsGroup.add(pip);
}
scene.add(pipsGroup);

// ---------- Pools: flames, smoke, stars, shots ----------
const puffPool = [];
for (let k = 0; k < 46; k++) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: flameTex, transparent: true, depthWrite: false }));
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
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.55), new THREE.MeshBasicMaterial({ map: starTexs[k % 4], transparent: true, depthWrite: false }));
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
    s.vx = Math.cos(a) * sp;
    s.vz = Math.sin(a) * sp;
    s.vy = toss ? 4 + Math.random() * 3 : 0;
    s.spin = (Math.random() - 0.5) * 12;
    s.mesh.position.set(x, y + Math.random() * 0.3, z);
    s.mesh.scale.setScalar(0.7 + Math.random() * 0.7);
  }
}

const shotPool = [];
for (let k = 0; k < 8; k++) {
  const g = new THREE.Group();
  const star = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.8), new THREE.MeshBasicMaterial({ map: starTexs[0], transparent: true, depthWrite: false }));
  star.rotation.x = -Math.PI / 2;
  star.renderOrder = 3;
  g.add(star);
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), flat(0xff8c1f));
  g.add(core);
  g.position.y = 1.0;
  g.visible = false;
  scene.add(g);
  shotPool.push({ group: g, star, active: false, vx: 0, vz: 0, life: 0 });
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
const chompSound = () => { beep(170, 0, 0.08, 'square', 0.16); beep(95, 0.06, 0.12, 'square', 0.14); noiseBurst(0.13, 900, 0.14); };
const shootSound = () => { beep(620, 0, 0.06, 'triangle', 0.1, 1100); };
const hitSound = () => { beep(240, 0, 0.08, 'sawtooth', 0.13); beep(480, 0.05, 0.06, 'square', 0.1); noiseBurst(0.08, 2200, 0.08); };
const downSound = () => { [520, 390, 270, 170].forEach((f, i) => beep(f, i * 0.11, 0.16, 'sawtooth', 0.12)); noiseBurst(0.5, 500, 0.12, 0.1); };
const chargeSound = () => { beep(260, 0, CHARGE_T, 'triangle', 0.08, 980); noiseBurst(CHARGE_T, 2600, 0.03); };
const breathSound = () => { noiseBurst(BREATH_T, 620, 0.2); noiseBurst(BREATH_T * 0.8, 1400, 0.08, 0.05); };
const deathSound = () => { [400, 300, 220, 150].forEach((f, i) => beep(f, i * 0.18, 0.3, 'sawtooth', 0.12)); noiseBurst(0.8, 700, 0.16); };
const winSound = () => { [392, 494, 587, 784, 988].forEach((f, i) => beep(f, i * 0.14, 0.22, 'triangle', 0.12)); beep(1175, 0.7, 0.5, 'triangle', 0.12); };
const tickSound = () => beep(1150, 0, 0.03, 'square', 0.05);
const roarSound = () => { beep(120, 0, 0.5, 'sawtooth', 0.15, 65); noiseBurst(0.4, 300, 0.12); };
const eatFanfare = () => { beep(520, 0, 0.07, 'triangle', 0.09); beep(780, 0.06, 0.09, 'triangle', 0.09); };

// ---------- Game state ----------
const keys = new Set();
const state = {
  phase: 'idle', // idle | play | dead | win | over
  t: 0,
  score: 0,
  eaten: 0,
  dragonsDown: 0,
  shotCd: 0,
  deathT: 0,
  winT: 0,
  flameEmit: 0,
  smokeEmit: 0,
  chargeWarned: 0,
  lastTickSec: -1,
  vel: new THREE.Vector3(),
  runPhase: 0,
};

const player = makeTrex();
scene.add(player.group);

const dinos = [];
for (let k = 0; k < DINO_COUNT; k++) {
  const group = makeMini(k);
  scene.add(group);
  dinos.push({
    group, cell: { i: 0, j: 0 }, next: { i: 0, j: 0 }, prev: { i: 99, j: 99 },
    hopPhase: Math.random() * 6, swapCd: 0, popT: 1, yaw: 0,
  });
}

const dragonM = makeDragon();
scene.add(dragonM.group);
const dragon = {
  ...dragonM,
  phase: 'chase', // chase | charge | breath | stun | down | gone
  cell: { i: 9, j: 0 }, next: { i: 9, j: 0 }, prev: { i: 99, j: 99 },
  hp: DRAGON_HP, fireCd: 3, chargeT: 0, breathT: 0, stunT: 0, downT: 0, goneT: 0,
  aimX: 0, aimZ: 1, reach: 0, yaw: 0, flap: 0, hitFlash: 0,
};

// ---------- HUD ----------
const timerEl = document.getElementById('timer');
const scoreEl = document.getElementById('score');
const msgEl = document.getElementById('msg');
const introEl = document.getElementById('intro');
const gameoverEl = document.getElementById('gameover');
const goTitleEl = document.getElementById('goTitle');
const finalScoreEl = document.getElementById('finalScore');
const finalDetailEl = document.getElementById('finalDetail');
const bestScoreEl = document.getElementById('bestScore');
const arrowEl = document.getElementById('dragonArrow');

let msgTimer = null;
function flash(text, bad = false, dur = 1000) {
  msgEl.textContent = text;
  msgEl.classList.toggle('bad', bad);
  msgEl.classList.add('show');
  clearTimeout(msgTimer);
  msgTimer = setTimeout(() => msgEl.classList.remove('show'), dur);
}
let popTimer = null;
function setScore() {
  scoreEl.textContent = `🍖 ${state.score}`;
  scoreEl.classList.add('pop');
  clearTimeout(popTimer);
  popTimer = setTimeout(() => scoreEl.classList.remove('pop'), 140);
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

function placeDragon(minR, maxR) {
  const pi = cellOf(player.group.position.x), pj = cellOf(player.group.position.z);
  const c = ringCell(pi, pj, minR, maxR);
  dragon.cell = { ...c };
  dragon.next = { ...c };
  dragon.prev = { i: c.i + 99, j: c.j };
  dragon.group.position.set(cellCX(c.i), 0, cellCX(c.j));
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
    if (fleeing) {
      sc = Math.hypot(cellCX(ni) - px, cellCX(nj) - pz) + Math.random() * 1.5 - (isRev ? 0.5 : 0);
    } else {
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

  // panic u-turn mid-corridor if you're charging straight at them
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
  let mx = tx - d.group.position.x, mz = tz - d.group.position.z;
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
    const targetYaw = Math.atan2(mx, mz);
    let dy = targetYaw - d.yaw;
    dy = ((dy % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2) - Math.PI;
    d.yaw += dy * (1 - Math.exp(-10 * dt));
    d.group.rotation.y = d.yaw;
  }
  // hoppity hop
  d.hopPhase += spd * dt * (fleeing ? 2.1 : 1.2);
  d.group.position.y = Math.abs(Math.sin(d.hopPhase)) * (fleeing ? 0.24 : 0.1);

  // too far behind? quietly rejoin the hunt
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

function dragonDecide() {
  if (state.phase === 'play') {
    const pi = cellOf(player.group.position.x), pj = cellOf(player.group.position.z);
    const next = bfsNextCell(dragon.cell.i, dragon.cell.j, pi, pj);
    if (next) { dragon.prev = { ...dragon.cell }; dragon.next = next; return; }
  }
  // idle wander (or BFS gave up): amble somewhere open
  const opts = openNeighborCells(dragon.cell.i, dragon.cell.j);
  if (!opts.length) { dragon.next = { ...dragon.cell }; return; }
  let best = opts[0], bestScore = -Infinity;
  for (const [ni, nj] of opts) {
    const isRev = ni === dragon.prev.i && nj === dragon.prev.j;
    const sc = Math.random() * 2 - (isRev ? 2.5 : 0) +
      (state.phase === 'play' ? -Math.hypot(cellCX(ni) - player.group.position.x, cellCX(nj) - player.group.position.z) * 0.2 : 0);
    if (sc > bestScore) { bestScore = sc; best = [ni, nj]; }
  }
  dragon.prev = { ...dragon.cell };
  dragon.next = { i: best[0], j: best[1] };
}

const Y_AXIS = new THREE.Vector3(0, 1, 0);
function dragonMouth(out) {
  out.set(0, 0, 2.0).applyAxisAngle(Y_AXIS, dragon.yaw);
  out.x += dragon.group.position.x;
  out.z += dragon.group.position.z;
  out.y = 1.7;
  return out;
}

const _mouth = new THREE.Vector3();
const _v = new THREE.Vector3();

function dragonStep(dt) {
  const g = dragon.group;
  dragon.flap += dt * (dragon.phase === 'charge' || dragon.phase === 'breath' ? 16 : 9);
  const flapA = Math.sin(dragon.flap) * 0.45;
  dragon.wings[0].rotation.y = -flapA;
  dragon.wings[1].rotation.y = flapA;
  dragon.hitFlash = Math.max(0, dragon.hitFlash - dt * 4);
  dragon.mats.forEach((m) => m.emissive.setRGB(dragon.hitFlash, dragon.hitFlash * 0.85, dragon.hitFlash * 0.7));

  pipsGroup.position.set(g.position.x, 0, g.position.z);
  pipsGroup.visible = dragon.phase !== 'down' && dragon.phase !== 'gone' && state.phase === 'play';
  pipsGroup.children.forEach((pip, ix) => { pip.visible = ix < dragon.hp; });

  const px = player.group.position.x, pz = player.group.position.z;
  const distP = Math.hypot(g.position.x - px, g.position.z - pz);

  if (dragon.phase === 'down') {
    dragon.downT += dt;
    g.rotation.y += dt * 14;
    const s = Math.max(0.05, 1 - dragon.downT * 0.95);
    g.scale.setScalar(s);
    g.position.y = Math.abs(Math.sin(dragon.downT * 9)) * 0.8 * s;
    if (dragon.downT > 1.0) {
      dragon.phase = 'gone';
      dragon.goneT = 6;
      g.visible = false;
      spawnPuff(g.position.x, g.position.z, true, 2.2);
    }
    return;
  }
  if (dragon.phase === 'gone') {
    dragon.goneT -= dt;
    if (dragon.goneT <= 0 && state.phase === 'play') {
      dragon.phase = 'chase';
      dragon.hp = DRAGON_HP;
      dragon.fireCd = 2.2;
      g.visible = true;
      g.scale.setScalar(1);
      g.rotation.set(0, dragon.yaw, 0);
      g.position.y = 0;
      placeDragon(9, 12);
      dragonDecide();
      roarSound();
      flash('🐉 הדרקון חזר!', true, 900);
    }
    return;
  }
  if (dragon.phase === 'stun') {
    dragon.stunT -= dt;
    g.position.y = Math.abs(Math.sin(dragon.stunT * 22)) * 0.15;
    if (dragon.stunT <= 0) {
      dragon.phase = 'chase';
      dragon.fireCd = Math.max(dragon.fireCd, 1.2);
      g.position.y = 0;
    }
    return;
  }

  if (dragon.phase === 'charge') {
    dragon.chargeT += dt;
    // track the player while inhaling, with a wobble of menace
    const targetYaw = Math.atan2(px - g.position.x, pz - g.position.z);
    let dy = targetYaw - dragon.yaw;
    dy = ((dy % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2) - Math.PI;
    dragon.yaw += dy * (1 - Math.exp(-6 * dt));
    g.rotation.y = dragon.yaw + Math.sin(dragon.chargeT * 40) * 0.04;
    dragon.glow.visible = true;
    dragon.glow.scale.setScalar(0.4 + dragon.chargeT / CHARGE_T * 1.3);
    if (dragon.chargeT >= CHARGE_T) {
      dragon.phase = 'breath';
      dragon.breathT = 0;
      dragon.glow.visible = false;
      dragonMouth(_mouth);
      const dx = px - _mouth.x, dz = pz - _mouth.z;
      const len = Math.hypot(dx, dz) || 1;
      dragon.aimX = dx / len;
      dragon.aimZ = dz / len;
      dragon.reach = marchReach(_mouth.x, _mouth.z, dragon.aimX, dragon.aimZ, FIRE_RANGE + 2);
      breathSound();
    }
    return;
  }

  if (dragon.phase === 'breath') {
    dragon.breathT += dt;
    dragonMouth(_mouth);
    const front = Math.min(dragon.breathT / 0.35, 1) * dragon.reach;
    state.flameEmit += dt * 65;
    while (state.flameEmit > 1) {
      state.flameEmit -= 1;
      const t = Math.random() * front;
      spawnPuff(
        _mouth.x + dragon.aimX * t + (Math.random() - 0.5) * 0.5,
        _mouth.z + dragon.aimZ * t + (Math.random() - 0.5) * 0.5,
        false, 0.7 + t * 0.12, dragon.aimX * 2.5, dragon.aimZ * 2.5
      );
    }
    // the deadly part
    if (state.phase === 'play') {
      const d = distToSegXZ(px, pz, _mouth.x, _mouth.z, _mouth.x + dragon.aimX * front, _mouth.z + dragon.aimZ * front);
      if (d < FIRE_R && losClear(_mouth.x, _mouth.z, px, pz)) die();
    }
    if (dragon.breathT >= BREATH_T) {
      dragon.phase = 'chase';
      dragon.fireCd = 2.4 + Math.random() * 1.4;
    }
    return;
  }

  // ---- chase ----
  const spd = state.phase === 'play' ? DRAGON_SPEED : DRAGON_SPEED * 0.45;
  const tx = cellCX(dragon.next.i), tz = cellCX(dragon.next.j);
  let mx = tx - g.position.x, mz = tz - g.position.z;
  const dist = Math.hypot(mx, mz);
  const step = spd * dt;
  if (dist <= step) {
    g.position.x = tx;
    g.position.z = tz;
    dragon.cell = { ...dragon.next };
    dragonDecide();
  } else {
    g.position.x += (mx / dist) * step;
    g.position.z += (mz / dist) * step;
    const targetYaw = Math.atan2(mx, mz);
    let dy = targetYaw - dragon.yaw;
    dy = ((dy % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2) - Math.PI;
    dragon.yaw += dy * (1 - Math.exp(-8 * dt));
  }
  g.rotation.y = dragon.yaw;
  g.position.y = Math.abs(Math.sin(dragon.flap * 0.5)) * 0.12;

  if (state.phase === 'play') {
    // keep him breathing down your neck even if you sprint away
    if (distP > 55) { placeDragon(10, 12); dragonDecide(); }
    // don't body-block: shove the player gently aside
    if (distP < 2.1 && distP > 0.01) {
      const push = (2.1 - distP);
      player.group.position.x += ((px - g.position.x) / distP) * push;
      player.group.position.z += ((pz - g.position.z) / distP) * push;
    }
    // fire?
    dragon.fireCd -= dt;
    if (dragon.fireCd <= 0 && distP < FIRE_RANGE) {
      dragonMouth(_mouth);
      if (losClear(_mouth.x, _mouth.z, px, pz)) {
        dragon.phase = 'charge';
        dragon.chargeT = 0;
        chargeSound();
        if (state.chargeWarned < 2) {
          state.chargeWarned++;
          flash('🔥 זהירות!', true, 800);
        }
      } else {
        dragon.fireCd = 0.25; // peek again soon
      }
    }
  }
}

// ---------- Shooting ----------
function fireShot() {
  const s = shotPool.find((q) => !q.active) || shotPool[0];
  s.active = true;
  s.group.visible = true;
  s.life = 1.4;
  const yaw = player.group.rotation.y;
  let dx = Math.sin(yaw), dz = Math.cos(yaw);
  const targetable = dragon.phase !== 'down' && dragon.phase !== 'gone';
  const mx = player.group.position.x + dx * 1.5;
  const mz = player.group.position.z + dz * 1.5;
  if (targetable) {
    const ddx = dragon.group.position.x - mx, ddz = dragon.group.position.z - mz;
    const dd = Math.hypot(ddx, ddz);
    if (dd < 16) { dx = ddx / dd; dz = ddz / dd; } // generous auto-aim: this is for kids
  }
  s.group.position.set(mx, 1.0, mz);
  s.vx = dx * SHOT_SPEED;
  s.vz = dz * SHOT_SPEED;
  shootSound();
  player.jawT = 1;
  poofStars(mx, 1.0, mz, 2);
}

function updateShots(dt) {
  const targetable = dragon.phase !== 'down' && dragon.phase !== 'gone';
  for (const s of shotPool) {
    if (!s.active) continue;
    s.life -= dt;
    // gentle homing so young trigger fingers still land the hit
    if (targetable) {
      const ddx = dragon.group.position.x - s.group.position.x;
      const ddz = dragon.group.position.z - s.group.position.z;
      if (ddx * ddx + ddz * ddz < 324) {
        const cur = Math.atan2(s.vx, s.vz);
        const want = Math.atan2(ddx, ddz);
        let d = want - cur;
        d = ((d % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2) - Math.PI;
        const a = cur + Math.max(-4.2 * dt, Math.min(4.2 * dt, d));
        s.vx = Math.sin(a) * SHOT_SPEED;
        s.vz = Math.cos(a) * SHOT_SPEED;
      }
    }
    s.group.position.x += s.vx * dt;
    s.group.position.z += s.vz * dt;
    s.star.rotation.z += dt * 14;
    let dead = s.life <= 0;
    if (!dead && pointBlocked(s.group.position.x, s.group.position.z, 0.12)) {
      poofStars(s.group.position.x, 0.9, s.group.position.z, 3);
      dead = true;
    }
    if (!dead && targetable) {
      const dd = Math.hypot(dragon.group.position.x - s.group.position.x, dragon.group.position.z - s.group.position.z);
      if (dd < 1.7) {
        dead = true;
        dragonHit();
        poofStars(s.group.position.x, 1.2, s.group.position.z, 6);
      }
    }
    if (dead) { s.active = false; s.group.visible = false; }
  }
}

function dragonHit() {
  dragon.hp -= 1;
  dragon.hitFlash = 1;
  dragon.glow.visible = false;
  state.score += 20;
  setScore();
  hitSound();
  if (dragon.hp <= 0) {
    dragon.phase = 'down';
    dragon.downT = 0;
    state.score += 100;
    state.dragonsDown += 1;
    setScore();
    downSound();
    flash('💨 הדרקון ברח! ‎+100');
  } else {
    dragon.phase = 'stun';
    dragon.stunT = 0.55;
  }
}

// ---------- Eat, die, win ----------
function eatCheck() {
  for (const d of dinos) {
    const dd = Math.hypot(d.group.position.x - player.group.position.x, d.group.position.z - player.group.position.z);
    if (dd < EAT_DIST) {
      state.score += 10;
      state.eaten += 1;
      setScore();
      chompSound();
      if (state.eaten % 5 === 0) { flash('יאמי! 🍖', false, 700); eatFanfare(); }
      player.jawT = 1;
      poofStars(d.group.position.x, 0.8, d.group.position.z, 5);
      placeDino(d, 7, 10);
      // a well-fed dino is a slightly rounder dino
      player.group.scale.setScalar(1 + Math.min(0.15, state.eaten * 0.007));
    }
  }
}

function die() {
  if (state.phase !== 'play') return;
  state.phase = 'dead';
  state.deathT = 0;
  deathSound();
  flash('נשרפתם! 🔥', true, 1300);
  player.mats.forEach((m) => m.color.setHex(0x4a4038));
}

function win() {
  state.phase = 'win';
  state.winT = 0;
  winSound();
  flash('🏆 ניצחתם!!', false, 1800);
  // the dragon knows when it's beaten
  if (dragon.phase !== 'gone') {
    dragon.phase = 'down';
    dragon.downT = 0;
  }
}

function showOver(won) {
  state.phase = 'over';
  goTitleEl.textContent = won ? '🏆 ניצחתם!! 🦖' : '🔥 הדרקון שרף אתכם!';
  finalScoreEl.textContent = `${state.score} נקודות!`;
  finalDetailEl.textContent = `אכלתם ${state.eaten} דינוזאורים 🍖 · שרדתם ${Math.min(WIN_TIME, state.t).toFixed(0)} שניות`;
  const best = Math.max(parseInt(localStorage.getItem('dino-best') || '0', 10), state.score);
  localStorage.setItem('dino-best', String(best));
  bestScoreEl.textContent = `השיא שלכם: ${best} נקודות ⭐`;
  gameoverEl.classList.remove('hidden');
}

// ---------- Flow ----------
function startGame() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  SEED = (Math.random() * 0xffffffff) | 0;
  state.phase = 'play';
  state.t = 0;
  state.score = 0;
  state.eaten = 0;
  state.dragonsDown = 0;
  state.shotCd = 0;
  state.chargeWarned = 0;
  state.lastTickSec = -1;
  state.vel.set(0, 0, 0);

  player.group.position.set(cellCX(0), 0, cellCX(0));
  player.group.rotation.set(0, 0, 0);
  player.group.scale.setScalar(1);
  player.jawT = 0;
  player.mats.forEach((m, ix) => m.color.setHex(player.origColors[ix]));

  dragon.phase = 'chase';
  dragon.hp = DRAGON_HP;
  dragon.fireCd = 3;
  dragon.hitFlash = 0;
  dragon.group.visible = true;
  dragon.group.scale.setScalar(1);
  dragon.group.rotation.set(0, 0, 0);
  dragon.group.position.y = 0;
  dragon.glow.visible = false;
  placeDragon(8, 10);
  dragonDecide();

  dinos.forEach((d, ix) => placeDino(d, 3 + (ix % 3), 6));

  puffPool.forEach((p) => { p.active = false; p.mesh.visible = false; });
  starPool.forEach((s) => { s.active = false; s.mesh.visible = false; });
  shotPool.forEach((s) => { s.active = false; s.group.visible = false; });

  timerEl.textContent = `⏱️ ${WIN_TIME}`;
  timerEl.classList.remove('low');
  scoreEl.textContent = '🍖 0';
  introEl.classList.add('hidden');
  gameoverEl.classList.add('hidden');
  rebuildWalls(true);
  roarSound();
  flash('🦖 לתפוס אותם!', false, 1100);
}

document.getElementById('startBtn').addEventListener('click', startGame);
document.getElementById('restartBtn').addEventListener('click', startGame);

window.addEventListener('keydown', (e) => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  keys.add(e.code);
  if ((state.phase === 'idle' || state.phase === 'over') && (e.code === 'Enter' || e.code === 'Space')) {
    startGame();
  }
});
window.addEventListener('keyup', (e) => keys.delete(e.code));
window.addEventListener('blur', () => keys.clear());

// ---------- Main loop ----------
const clock = new THREE.Clock();
const _cam = new THREE.Vector3();
const _look = new THREE.Vector3(cellCX(0), 0, cellCX(0));
const _proj = new THREE.Vector3();

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

function update(dt) {
  const p = player.group;

  if (state.phase === 'play') {
    state.t += dt;
    const left = Math.max(0, WIN_TIME - state.t);
    timerEl.textContent = `⏱️ ${Math.ceil(left)}`;
    if (left < 30) timerEl.classList.add('low');
    if (left < 10 && Math.ceil(left) !== state.lastTickSec) {
      state.lastTickSec = Math.ceil(left);
      tickSound();
    }
    if (left <= 0) { win(); return; }

    // --- you, the apex predator ---
    const input = new THREE.Vector3(
      (keys.has('ArrowRight') || keys.has('KeyD') ? 1 : 0) - (keys.has('ArrowLeft') || keys.has('KeyA') ? 1 : 0),
      0,
      (keys.has('ArrowDown') || keys.has('KeyS') ? 1 : 0) - (keys.has('ArrowUp') || keys.has('KeyW') ? 1 : 0)
    );
    if (input.lengthSq() > 0) input.normalize();
    _v.copy(input).multiplyScalar(PLAYER_SPEED);
    state.vel.lerp(_v, 1 - Math.exp(-12 * dt));
    p.position.x += state.vel.x * dt;
    p.position.z += state.vel.z * dt;
    collideWalls(p.position, 0.8);

    const moving = state.vel.length() > 1;
    if (moving) {
      state.runPhase += state.vel.length() * dt * 1.5;
      const targetYaw = Math.atan2(state.vel.x, state.vel.z);
      let dy = targetYaw - p.rotation.y;
      dy = ((dy % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2) - Math.PI;
      p.rotation.y += dy * (1 - Math.exp(-10 * dt));
    }
    p.position.y = moving ? Math.abs(Math.sin(state.runPhase)) * 0.14 : 0;
    player.legs[0].rotation.x = moving ? Math.sin(state.runPhase) * 0.9 : 0;
    player.legs[1].rotation.x = moving ? -Math.sin(state.runPhase) * 0.9 : 0;
    player.tail.rotation.y = Math.sin(state.runPhase * 0.7) * 0.18;
    player.shadow.position.y = 0.03 - p.position.y;

    // jaw: chomps when eating or roaring
    player.jawT = Math.max(0, (player.jawT || 0) - dt * 3.2);
    player.jaw.rotation.x = Math.sin(Math.min(1, player.jawT) * Math.PI) * 0.65;

    // --- shooting ---
    state.shotCd -= dt;
    if (keys.has('Space') && state.shotCd <= 0) {
      state.shotCd = SHOT_CD;
      fireShot();
    }

    eatCheck();
    dinos.forEach((d) => dinoStep(d, dt));
    dragonStep(dt);
    updateShots(dt);
    rebuildWalls();
  } else if (state.phase === 'idle') {
    // attract mode: everyone just mills about behind the intro card
    state.t += dt;
    dinos.forEach((d) => dinoStep(d, dt));
    dragonStep(dt);
    p.position.y = Math.abs(Math.sin(state.t * 2.5)) * 0.1;
  } else if (state.phase === 'dead') {
    state.deathT += dt;
    // roll over, well-done
    p.rotation.z = Math.min(Math.PI / 2, state.deathT * 3);
    p.position.y = Math.abs(Math.sin(state.deathT * 6)) * 0.3 * Math.max(0, 1 - state.deathT);
    state.smokeEmit += dt * 14;
    while (state.smokeEmit > 1) {
      state.smokeEmit -= 1;
      spawnPuff(p.position.x + (Math.random() - 0.5), p.position.z + (Math.random() - 0.5), true, 1.1);
    }
    dragonStep(dt);
    if (state.deathT > 1.5) showOver(false);
  } else if (state.phase === 'win') {
    state.winT += dt;
    // victory dance!
    p.rotation.y += dt * 7;
    p.position.y = Math.abs(Math.sin(state.winT * 8)) * 0.5;
    if (state.winT < 1.2 && Math.random() < 0.3) {
      poofStars(p.position.x + (Math.random() - 0.5) * 6, 2.5, p.position.z + (Math.random() - 0.5) * 6, 2, true);
    }
    dinos.forEach((d) => dinoStep(d, dt));
    dragonStep(dt);
    if (state.winT > 1.9) showOver(true);
  }

  updatePools(dt);

  // --- camera: straight down at the maze, drifting after you ---
  if (state.phase === 'idle') {
    _cam.set(cellCX(0) + Math.sin(state.t * 0.12) * 5, 27, cellCX(0) + 10 + Math.cos(state.t * 0.12) * 4);
    camera.position.lerp(_cam, 1 - Math.exp(-1.5 * dt));
    _look.lerp(_v.set(cellCX(0), 0, cellCX(0)), 1 - Math.exp(-2 * dt));
  } else {
    _cam.set(p.position.x + state.vel.x * 0.22, 29, p.position.z + state.vel.z * 0.22 + 10.5);
    camera.position.lerp(_cam, 1 - Math.exp(-4 * dt));
    _look.lerp(_v.set(p.position.x + state.vel.x * 0.22, 0, p.position.z + state.vel.z * 0.22), 1 - Math.exp(-4 * dt));
  }
  camera.lookAt(_look);

  // floor tags along, snapping so the pattern never swims
  floor.position.x = Math.round(p.position.x / FLOOR_SNAP) * FLOOR_SNAP;
  floor.position.z = Math.round(p.position.z / FLOOR_SNAP) * FLOOR_SNAP;

  // --- the dragon compass: a 🐉 on the screen edge when he's out of view ---
  const targetable = dragon.phase !== 'down' && dragon.phase !== 'gone';
  if (state.phase === 'play' && targetable) {
    _proj.copy(dragon.group.position).setY(1);
    _proj.project(camera);
    const off = Math.abs(_proj.x) > 0.92 || Math.abs(_proj.y) > 0.92;
    if (off) {
      const cx = Math.max(-0.92, Math.min(0.92, _proj.x));
      const cy = Math.max(-0.88, Math.min(0.88, _proj.y));
      arrowEl.style.display = 'block';
      arrowEl.style.left = `${(cx * 0.5 + 0.5) * window.innerWidth}px`;
      arrowEl.style.top = `${(-cy * 0.5 + 0.5) * window.innerHeight}px`;
      arrowEl.classList.toggle('charging', dragon.phase === 'charge' || dragon.phase === 'breath');
    } else {
      arrowEl.style.display = 'none';
    }
  } else {
    arrowEl.style.display = 'none';
  }
}

function tick() {
  requestAnimationFrame(tick);
  update(Math.min(clock.getDelta(), 0.05));
  renderer.render(scene, camera);
}

// set the idle scene
placeDragon(4, 6);
dragonDecide();
dinos.forEach((d, ix) => placeDino(d, 2, 4));
rebuildWalls(true);
tick();

// debugging hook for tests
window.__dino = {
  state, player, dragon, dinos, startGame, update,
  render: () => renderer.render(scene, camera),
  losClear, pointBlocked, cellCX, cellOf,
  openX, openZ, placeDragon, fireShot, die, win,
};
