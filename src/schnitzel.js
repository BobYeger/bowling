import * as THREE from 'three';

// ---------- Marker palette (same paper world as the other games) ----------
const PAPER = 0xf8f5ec;
const SCHNITZEL_DARK = 0x9c6410;
const PAN_GRAY = 0x4a4a4a;
const PAN_DARK = 0x1c1c1c;
const WOOD = 0xa9713d;
const WOOD_DARK = 0x77491f;
const FRIDGE_BLUE = 0x2b4bd7;
const POT_GRAY = 0x7d8a94;
const POT_DARK = 0x4c565e;

// ---------- Constants ----------
const ROOM_X = 15;            // playable half-extents
const ROOM_Z = 10;
const PLAYER_SPEED = 10.5;
const JUMP_VY = 9.5;
const G = 24;
const CATCH_DIST = 2.1;
const JUMP_SAFE_Y = 0.75;     // above this height the pan can't scoop you
const GRACE_TIME = 1.5;

// ---------- Renderer / scene ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.getElementById('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(PAPER);

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 300);
camera.position.set(0, 25, 21);
camera.lookAt(0, 0, -1);

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
function makeTileTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#f8f5ec';
  g.fillRect(0, 0, 256, 256);
  g.fillStyle = '#dcebf3';
  g.fillRect(0, 0, 128, 128);
  g.fillRect(128, 128, 128, 128);
  g.strokeStyle = '#b9cdd9';
  g.lineWidth = 5;
  g.strokeRect(2, 2, 252, 252);
  g.beginPath(); g.moveTo(128, 0); g.lineTo(128, 256); g.stroke();
  g.beginPath(); g.moveTo(0, 128); g.lineTo(256, 128); g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function makeCrumbTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#d9932c';
  g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 260; i++) {
    g.fillStyle = ['#c07f1e', '#e8a83e', '#b3651a', '#eab558'][i % 4];
    g.beginPath();
    g.arc(Math.random() * 128, Math.random() * 128, 1.5 + Math.random() * 3, 0, Math.PI * 2);
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// marker-drawn faces, swappable per mood
function makeFaceTexture(kind) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const ink = kind.startsWith('pan') ? '#f4f0e6' : '#241c10';
  g.strokeStyle = ink;
  g.fillStyle = ink;
  g.lineWidth = 7;
  g.lineCap = 'round';
  const eyeY = 52;
  [40, 88].forEach((x) => {
    g.beginPath();
    g.arc(x, eyeY, 9, 0, Math.PI * 2);
    kind === 'schnitzel-sad' ? g.stroke() : g.fill();
  });
  if (kind === 'pan-angry') {
    g.lineWidth = 9;
    g.beginPath(); g.moveTo(26, 30); g.lineTo(52, 42); g.stroke();
    g.beginPath(); g.moveTo(102, 30); g.lineTo(76, 42); g.stroke();
    g.lineWidth = 7;
    g.beginPath(); g.arc(64, 108, 22, Math.PI * 1.15, Math.PI * 1.85); g.stroke();
  } else if (kind === 'pan-happy') {
    g.beginPath(); g.arc(64, 78, 26, Math.PI * 0.15, Math.PI * 0.85); g.stroke();
  } else if (kind === 'schnitzel-happy') {
    g.beginPath(); g.arc(64, 74, 24, Math.PI * 0.15, Math.PI * 0.85); g.stroke();
  } else {
    g.beginPath(); g.arc(64, 112, 22, Math.PI * 1.15, Math.PI * 1.85); g.stroke();
    g.beginPath(); g.arc(40, 74, 5, 0, Math.PI * 2); g.fill(); // a little tear
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const tileTex = makeTileTexture();
const crumbTex = makeCrumbTexture();
const faces = {
  schnitzelHappy: makeFaceTexture('schnitzel-happy'),
  schnitzelSad: makeFaceTexture('schnitzel-sad'),
  panAngry: makeFaceTexture('pan-angry'),
  panHappy: makeFaceTexture('pan-happy'),
};

// ---------- The kitchen ----------
tileTex.repeat.set(8, 5.5);
const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(ROOM_X * 2 + 4, ROOM_Z * 2 + 4),
  new THREE.MeshBasicMaterial({ map: tileTex })
);
floor.rotation.x = -Math.PI / 2;
scene.add(floor);
const paperGround = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), flat(PAPER));
paperGround.rotation.x = -Math.PI / 2;
paperGround.position.y = -0.02;
scene.add(paperGround);

function counter(w, d, x, z) {
  const c = new THREE.Mesh(new THREE.BoxGeometry(w, 2, d), toon(0xfdfbf4));
  c.position.set(x, 1, z);
  outline(c, 0xb9a98a, 1.03);
  scene.add(c);
  const top = new THREE.Mesh(new THREE.BoxGeometry(w + 0.3, 0.18, d + 0.3), toon(WOOD));
  top.position.set(x, 2.1, z);
  outline(top, WOOD_DARK, 1.05);
  scene.add(top);
}
counter(ROOM_X * 2 + 4, 2, 0, -ROOM_Z - 2.1);
counter(2, ROOM_Z * 2 - 1, -ROOM_X - 2.1, -0.5);
counter(2, ROOM_Z * 2 - 1, ROOM_X + 2.1, -0.5);

// stove burners drawn on the back counter
[[-7, 0], [-4.5, 0], [-7, 0.9], [-4.5, 0.9]].forEach(([dx, dz]) => {
  const burner = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.06, 16), flat(PAN_DARK));
  burner.position.set(dx, 2.22, -ROOM_Z - 1.6 + dz);
  scene.add(burner);
});
// fridge in the corner
const fridge = new THREE.Mesh(new THREE.BoxGeometry(3, 5.4, 2.4), toon(0xfdfdfa));
fridge.position.set(ROOM_X + 0.4, 2.7, -ROOM_Z - 1.9);
outline(fridge, FRIDGE_BLUE, 1.04);
scene.add(fridge);
const fridgeHandle = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.6, 0.15), toon(FRIDGE_BLUE));
fridgeHandle.position.set(ROOM_X - 0.9, 3.1, -ROOM_Z - 0.6);
scene.add(fridgeHandle);

// obstacles inside the kitchen: a table and a big pot
const OBSTACLES = [
  { x: -5.5, z: 3, r: 2.7 },
  { x: 6.5, z: -3.5, r: 1.6 },
];
const table = new THREE.Group();
const tableTop = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 0.25, 20), toon(WOOD));
tableTop.position.y = 2.1;
outline(tableTop, WOOD_DARK, 1.05);
table.add(tableTop);
[[-1.3, -1.3], [1.3, -1.3], [-1.3, 1.3], [1.3, 1.3]].forEach(([lx, lz]) => {
  const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 2.1, 8), toon(WOOD_DARK));
  leg.position.set(lx, 1, lz);
  table.add(leg);
});
table.position.set(OBSTACLES[0].x, 0, OBSTACLES[0].z);
scene.add(table);

const pot = new THREE.Group();
const potBody = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.3, 1.5, 18), toon(POT_GRAY));
potBody.position.y = 0.75;
outline(potBody, POT_DARK, 1.06);
pot.add(potBody);
const lid = new THREE.Mesh(new THREE.CylinderGeometry(1.45, 1.45, 0.16, 18), toon(POT_DARK));
lid.position.y = 1.55;
pot.add(lid);
const knob = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), toon(POT_GRAY));
knob.position.y = 1.75;
pot.add(knob);
pot.position.set(OBSTACLES[1].x, 0, OBSTACLES[1].z);
scene.add(pot);

// ---------- The schnitzel (that's you!) ----------
const schn = new THREE.Group();
const schnBody = new THREE.Mesh(
  new THREE.SphereGeometry(1, 20, 14),
  new THREE.MeshToonMaterial({ map: crumbTex, gradientMap })
);
schnBody.scale.set(1.25, 0.42, 1.0);
outline(schnBody, SCHNITZEL_DARK, 1.06);
schn.add(schnBody);
const schnFace = new THREE.Mesh(
  new THREE.PlaneGeometry(1.35, 1.35),
  new THREE.MeshBasicMaterial({ map: faces.schnitzelHappy, transparent: true })
);
schnFace.rotation.x = -Math.PI / 2 + 0.55; // tilted up toward the camera
schnFace.position.set(0, 0.42, 0.25);
schn.add(schnFace);
const schnShadow = makeShadow(1.1);
schn.add(schnShadow);
scene.add(schn);

// ---------- The pan (it's angry) ----------
const pan = new THREE.Group();
const panBody = new THREE.Group();
const panBase = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.4, 0.22, 22), toon(PAN_GRAY));
panBase.position.y = 0.11;
outline(panBase, PAN_DARK, 1.06);
panBody.add(panBase);
const panRim = new THREE.Mesh(new THREE.CylinderGeometry(1.55, 1.5, 0.5, 22, 1, true), toon(PAN_GRAY));
panRim.position.y = 0.45;
const rimShell = new THREE.Mesh(panRim.geometry, new THREE.MeshBasicMaterial({ color: PAN_DARK, side: THREE.BackSide }));
rimShell.scale.setScalar(1.06);
panRim.add(rimShell);
panBody.add(panRim);
const panFace = new THREE.Mesh(
  new THREE.PlaneGeometry(1.7, 1.7),
  new THREE.MeshBasicMaterial({ map: faces.panAngry, transparent: true })
);
// on the front rim (opposite the handle), tilted up — readable from the chase cam and the close-up
panFace.rotation.set(0.62, Math.PI, 0);
panFace.position.set(0, 0.8, -0.9);
panBody.add(panFace);
const panHandle = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 1.9, 4, 10), toon(PAN_DARK));
panHandle.rotation.x = Math.PI / 2;
panHandle.position.set(0, 0.3, 2.4); // sticks out the back (pan faces -z locally... flipped by yaw)
panBody.add(panHandle);
pan.add(panBody);
const panShadow = makeShadow(1.5);
pan.add(panShadow);
scene.add(pan);

// ---------- Audio ----------
let audioCtx = null;
function beep(freq, t0, dur, type = 'square', vol = 0.12) {
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(vol, audioCtx.currentTime + t0);
  g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + t0 + dur);
  o.connect(g).connect(audioCtx.destination);
  o.start(audioCtx.currentTime + t0);
  o.stop(audioCtx.currentTime + t0 + dur + 0.05);
}
function sizzle() {
  if (!audioCtx) return;
  const len = audioCtx.sampleRate * 0.6;
  const buf = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = audioCtx.createBufferSource();
  src.buffer = buf;
  const filter = audioCtx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 3200;
  const g = audioCtx.createGain();
  g.gain.value = 0.16;
  src.connect(filter).connect(g).connect(audioCtx.destination);
  src.start();
}
const jumpSound = () => { if (audioCtx) { beep(300, 0, 0.07, 'triangle', 0.14); beep(560, 0.05, 0.1, 'triangle', 0.1); } };
const caughtSound = () => { if (audioCtx) { beep(220, 0, 0.12, 'square', 0.14); beep(130, 0.1, 0.25, 'square', 0.12); sizzle(); } };
const tossSound = () => { if (audioCtx) { beep(400, 0, 0.09, 'triangle', 0.1); beep(700, 0.07, 0.09, 'triangle', 0.1); beep(1000, 0.14, 0.12, 'triangle', 0.08); } };
const gameOverSound = () => { if (audioCtx) [400, 300, 220, 150].forEach((f, i) => beep(f, i * 0.18, 0.3, 'sawtooth')); };

// ---------- Game state ----------
const keys = new Set();
const state = {
  phase: 'idle', // idle | play | scoop | toss | over
  time: 0,
  lives: 3,
  vel: new THREE.Vector3(),
  vy: 0,
  panVel: new THREE.Vector3(),
  grace: 0,
  scoopT: 0,
  tossVel: new THREE.Vector3(),
  runPhase: 0,
};

const timerEl = document.getElementById('timer');
const livesEl = document.getElementById('lives');
const msgEl = document.getElementById('msg');
const introEl = document.getElementById('intro');
const gameoverEl = document.getElementById('gameover');
const finalScoreEl = document.getElementById('finalScore');
const bestScoreEl = document.getElementById('bestScore');

function setLives() {
  livesEl.textContent = '❤️'.repeat(state.lives) + '🤍'.repeat(3 - state.lives);
}

let msgTimer = null;
function flash(text, bad = false) {
  msgEl.textContent = text;
  msgEl.classList.toggle('bad', bad);
  msgEl.classList.add('show');
  clearTimeout(msgTimer);
  msgTimer = setTimeout(() => msgEl.classList.remove('show'), 1000);
}

function setMoods(swapped) {
  schnFace.material.map = swapped ? faces.schnitzelSad : faces.schnitzelHappy;
  panFace.material.map = swapped ? faces.panHappy : faces.panAngry;
}

// keep a point inside the room and outside the furniture
function resolveCollisions(pos, bodyR) {
  pos.x = THREE.MathUtils.clamp(pos.x, -ROOM_X, ROOM_X);
  pos.z = THREE.MathUtils.clamp(pos.z, -ROOM_Z, ROOM_Z);
  for (const o of OBSTACLES) {
    const dx = pos.x - o.x, dz = pos.z - o.z;
    const d = Math.hypot(dx, dz);
    const min = o.r + bodyR * 0.4;
    if (d < min && d > 0.001) {
      pos.x = o.x + (dx / d) * min;
      pos.z = o.z + (dz / d) * min;
    }
  }
}

// ---------- Flow ----------
function startGame() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  state.phase = 'play';
  state.time = 0;
  state.lives = 3;
  state.grace = 0;
  state.vel.set(0, 0, 0);
  state.vy = 0;
  state.panVel.set(0, 0, 0);
  schn.position.set(-8, 0, 0);
  schn.visible = true;
  pan.position.set(10, 0, 5);
  pan.rotation.set(0, 0, 0);
  panBody.rotation.set(0, 0, 0);
  panBody.position.y = 0;
  setMoods(false);
  setLives();
  introEl.classList.add('hidden');
  gameoverEl.classList.add('hidden');
}

function startScoop() {
  state.phase = 'scoop';
  state.scoopT = 0;
  state.lives -= 1;
  setLives();
  setMoods(true); // the pan gloats, the schnitzel sulks
  caughtSound();
  flash('נתפסת! 😜', true);
}

function gameOver() {
  state.phase = 'over';
  gameOverSound();
  const secs = state.time.toFixed(1);
  finalScoreEl.textContent = `שרדתם ${secs} שניות! 🍳`;
  const best = Math.max(parseFloat(localStorage.getItem('schnitzel-best') || '0'), state.time);
  localStorage.setItem('schnitzel-best', String(best));
  bestScoreEl.textContent = `השיא שלכם: ${best.toFixed(1)} שניות ⭐`;
  gameoverEl.classList.remove('hidden');
}

document.getElementById('startBtn').addEventListener('click', startGame);
document.getElementById('restartBtn').addEventListener('click', startGame);

window.addEventListener('keydown', (e) => {
  keys.add(e.code);
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  if ((state.phase === 'idle' || state.phase === 'over') && (e.code === 'Enter' || e.code === 'Space')) {
    if (!introEl.classList.contains('hidden') || !gameoverEl.classList.contains('hidden')) startGame();
    return;
  }
  if (e.code === 'Space' && state.phase === 'play' && schn.position.y < 0.05) {
    state.vy = JUMP_VY;
    jumpSound();
  }
});
window.addEventListener('keyup', (e) => keys.delete(e.code));

// ---------- Main loop ----------
const clock = new THREE.Clock();
const _v = new THREE.Vector3();
const _cam = new THREE.Vector3();

function update(dt) {
  if (state.phase === 'play') {
    state.time += dt;
    timerEl.textContent = `זמן: ${state.time.toFixed(1)}`;
    state.grace = Math.max(0, state.grace - dt);

    // --- schnitzel movement: snappy, all directions ---
    const input = new THREE.Vector3(
      (keys.has('ArrowRight') || keys.has('KeyD') ? 1 : 0) - (keys.has('ArrowLeft') || keys.has('KeyA') ? 1 : 0),
      0,
      (keys.has('ArrowDown') || keys.has('KeyS') ? 1 : 0) - (keys.has('ArrowUp') || keys.has('KeyW') ? 1 : 0)
    );
    if (input.lengthSq() > 0) input.normalize();
    _v.copy(input).multiplyScalar(PLAYER_SPEED);
    state.vel.lerp(_v, 1 - Math.exp(-12 * dt));
    schn.position.x += state.vel.x * dt;
    schn.position.z += state.vel.z * dt;
    resolveCollisions(schn.position, 1.2);

    // jump
    state.vy -= G * dt;
    schn.position.y = Math.max(0, schn.position.y + state.vy * dt);
    if (schn.position.y === 0 && state.vy < 0) state.vy = 0;

    // waddle hop + squash & stretch
    const moving = state.vel.length() > 1;
    if (schn.position.y === 0 && moving) {
      state.runPhase += state.vel.length() * dt * 1.6;
      schn.position.y = Math.abs(Math.sin(state.runPhase)) * 0.14;
    }
    const stretch = schn.position.y > 0.2 ? 1.15 : 1;
    schnBody.scale.y += (0.42 * stretch - schnBody.scale.y) * (1 - Math.exp(-10 * dt));
    schn.rotation.y += ((moving ? Math.atan2(state.vel.x, state.vel.z) : schn.rotation.y) - schn.rotation.y) * (1 - Math.exp(-8 * dt));
    schnShadow.position.y = 0.03 - schn.position.y;
    schnShadow.scale.setScalar(Math.max(0.5, 1 - schn.position.y * 0.15));
    // blink while safe after a toss
    schnBody.visible = state.grace > 0 ? Math.floor(state.time * 9) % 2 === 0 : true;

    // --- the pan gives chase, momentum and all ---
    const panSpeed = Math.min(13, 6.5 + state.time * 0.11);
    const agility = Math.min(16, 9 + state.time * 0.05);
    _v.copy(schn.position).sub(pan.position);
    _v.y = 0;
    const dist = _v.length();
    _v.normalize().multiplyScalar(panSpeed).sub(state.panVel);
    const steer = agility * dt;
    if (_v.length() > steer) _v.setLength(steer);
    state.panVel.add(_v);
    pan.position.x += state.panVel.x * dt;
    pan.position.z += state.panVel.z * dt;
    resolveCollisions(pan.position, 1.5);
    // face where it's sliding, bank into turns
    if (state.panVel.lengthSq() > 0.5) {
      const targetYaw = Math.atan2(state.panVel.x, state.panVel.z) + Math.PI; // handle trails behind
      let dYaw = targetYaw - pan.rotation.y;
      dYaw = ((dYaw % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2) - Math.PI;
      pan.rotation.y += dYaw * (1 - Math.exp(-6 * dt));
      panBody.rotation.z += (THREE.MathUtils.clamp(-dYaw * 1.5, -0.25, 0.25) - panBody.rotation.z) * (1 - Math.exp(-6 * dt));
    }

    // --- the catch: scooped like a spatula, but only if you're low ---
    if (dist < CATCH_DIST && schn.position.y < JUMP_SAFE_Y && state.grace <= 0) {
      startScoop();
    }
  } else if (state.phase === 'scoop') {
    state.scoopT += dt;
    const t = state.scoopT;
    // slide under and lift: the schnitzel rides in the pan
    const lift = THREE.MathUtils.clamp((t - 0.25) / 0.5, 0, 1);
    panBody.position.y = lift * 2.2;
    panBody.rotation.z = Math.sin(Math.min(t * 4, Math.PI)) * -0.35 * (1 - lift); // the scoop tilt
    schn.position.copy(pan.position);
    schn.position.y = panBody.position.y + 0.55;
    if (lift < 1) schn.rotation.y += dt * (1 - lift) * 6;
    else schn.rotation.y *= Math.exp(-6 * dt); // settle facing the camera, so we see the sulk
    // turn to face the camera and do a victory wiggle
    let dY = Math.PI - pan.rotation.y;
    dY = ((dY % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2) - Math.PI;
    pan.rotation.y += dY * (1 - Math.exp(-5 * dt));
    if (lift >= 1) pan.rotation.y += Math.sin(t * 14) * dt * 2.5;
    if (t > 1.5) {
      // toss the schnitzel back into the kitchen
      state.phase = 'toss';
      tossSound();
      let target;
      let tries = 0;
      do {
        target = new THREE.Vector3((Math.random() * 2 - 1) * (ROOM_X - 2), 0, (Math.random() * 2 - 1) * (ROOM_Z - 2));
        tries++;
      } while (tries < 20 && (target.distanceTo(pan.position) < 10 || OBSTACLES.some((o) => Math.hypot(target.x - o.x, target.z - o.z) < o.r + 1.5)));
      const T = 0.85;
      state.tossVel.copy(target).sub(schn.position).divideScalar(T);
      state.tossVel.y += 0.5 * G * T;
    }
  } else if (state.phase === 'toss') {
    state.tossVel.y -= G * dt;
    schn.position.addScaledVector(state.tossVel, dt);
    schn.rotation.y += dt * 9;
    schnShadow.position.y = 0.03 - schn.position.y;
    // pan settles back down, gets angry again
    panBody.position.y *= Math.exp(-3 * dt);
    if (schn.position.y <= 0) {
      schn.position.y = 0;
      resolveCollisions(schn.position, 1.2);
      setMoods(false);
      panBody.position.y = 0;
      if (state.lives <= 0) {
        gameOver();
      } else {
        state.phase = 'play';
        state.grace = GRACE_TIME;
        state.vel.set(0, 0, 0);
        state.vy = 0;
      }
    }
  }

  // camera: dive in close for the gotcha moment, drift gently otherwise
  if (state.phase === 'scoop') {
    _cam.set(pan.position.x * 0.5, 12, pan.position.z + 10);
    camera.position.lerp(_cam, 1 - Math.exp(-3.5 * dt));
    camera.lookAt(pan.position.x, 2.2, pan.position.z);
  } else {
    _cam.set(schn.position.x * 0.25, 25, 21);
    camera.position.lerp(_cam, 1 - Math.exp(-2 * dt));
    camera.lookAt(camera.position.x * 0.5, 0, -1);
  }
}

function tick() {
  requestAnimationFrame(tick);
  update(Math.min(clock.getDelta(), 0.05));
  renderer.render(scene, camera);
}

schn.position.set(-8, 0, 0);
pan.position.set(10, 0, 5);
setLives();
tick();

// debugging hook for tests
window.__schnitzel = { state, schn, pan, startGame, update, render: () => renderer.render(scene, camera) };
