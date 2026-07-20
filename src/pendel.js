import * as THREE from 'three';

// ---------- Marker palette (same paper world as the bowling game) ----------
const PAPER = 0xf8f5ec;
const INK = 0x2a2a2a;
const GRASS_GREEN = 0x2b7a1f;
const SHIRT_GREEN = 0x69a80f;
const SHIRT_GREEN_DARK = 0x40700a;
const NAVY = 0x27408b;
const SKIN = 0xf2b09a;
const SKIN_DARK = 0xc97f66;
const RET_RED = 0xd8281c;
const ORANGE = 0xe07612;
const ORANGE_DARK = 0xa9560a;

// ---------- Constants ----------
const GOAL_Z = -19;
const GOAL_HALF_W = 6;
const GOAL_H = 4.6;
const G = 18;                 // cartoon gravity
const BALL_R = 0.5;
const HEAD_REACH = 2.3;       // how close the ball must be to head it
const FLIGHT_T = 1.7;         // seconds for the lob to arrive

// ---------- Renderer / scene ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.getElementById('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(PAPER);
scene.fog = new THREE.Fog(PAPER, 55, 130);

const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 300);
camera.position.set(0, 3.6, 7.2);
camera.lookAt(0, 2.0, GOAL_Z);

scene.add(new THREE.HemisphereLight(0xffffff, 0xcfc4a8, 1.4));
const sun = new THREE.DirectionalLight(0xfff4e0, 1.2);
sun.position.set(8, 20, 14);
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
  s.position.y = 0.02;
  return s;
}

// ---------- Hand-drawn textures ----------
function makePaperTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#f8f5ec';
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 140; i++) {
    g.fillStyle = Math.random() < 0.5 ? '#efeadd' : '#f1ece0';
    g.beginPath();
    g.arc(Math.random() * 256, Math.random() * 256, 1 + Math.random() * 2.2, 0, Math.PI * 2);
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function makeNetTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 128, 128);
  g.strokeStyle = '#2a2a2a';
  g.lineWidth = 2.5;
  for (let i = 0; i <= 128; i += 14) {
    g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 128); g.stroke();
    g.beginPath(); g.moveTo(0, i); g.lineTo(128, i); g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function makeStripeTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#f4f4f0';
  g.fillRect(0, 0, 64, 64);
  g.fillStyle = '#27408b';
  for (let x = 0; x < 64; x += 16) g.fillRect(x, 0, 8, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function makeSoccerTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#fdfdf8';
  g.fillRect(0, 0, 128, 128);
  g.fillStyle = '#1c1c1c';
  for (let i = 0; i < 9; i++) {
    const x = (i % 3) * 42 + 21 + (Math.random() * 10 - 5);
    const y = Math.floor(i / 3) * 42 + 21 + (Math.random() * 10 - 5);
    g.beginPath();
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      const r = 9 + Math.random() * 2;
      k === 0 ? g.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r) : g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    }
    g.closePath();
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const paperTex = makePaperTexture();
const netTex = makeNetTexture();
const stripeTex = makeStripeTexture();
const soccerTex = makeSoccerTexture();

// ---------- The paper pitch ----------
paperTex.repeat.set(12, 12);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), new THREE.MeshBasicMaterial({ map: paperTex }));
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

// a hand-drawn penalty box: green marker lines
const lineMat = flat(GRASS_GREEN);
[[0, GOAL_Z + 4.5, 20, 0.18, 0.008], [-10, GOAL_Z + 9.75, 0.18, 10.7, 0.006], [10, GOAL_Z + 9.75, 0.18, 10.7, -0.006]].forEach(([x, z, w, d, tilt]) => {
  const line = new THREE.Mesh(new THREE.BoxGeometry(w, 0.02, d), lineMat);
  line.position.set(x, 0.01, z);
  line.rotation.y = tilt;
  scene.add(line);
});

// ---------- The goal: posts + domed net, like the drawing ----------
const goal = new THREE.Group();
const postMat = toon(INK);
[-GOAL_HALF_W, GOAL_HALF_W].forEach((x) => {
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, GOAL_H, 10), postMat);
  post.position.set(x, GOAL_H / 2, GOAL_Z);
  goal.add(post);
});
const crossbar = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, GOAL_HALF_W * 2 + 0.3, 10), postMat);
crossbar.rotation.z = Math.PI / 2;
crossbar.position.set(0, GOAL_H, GOAL_Z);
goal.add(crossbar);

const netMat = new THREE.MeshBasicMaterial({ map: netTex, transparent: true, side: THREE.DoubleSide });
netMat.map.repeat.set(8, 3);
const netBack = new THREE.Mesh(new THREE.PlaneGeometry(GOAL_HALF_W * 2, GOAL_H - 1.5), netMat);
netBack.position.set(0, (GOAL_H - 1.5) / 2, GOAL_Z - 1.6);
goal.add(netBack);
// domed roof, like the kid drew it
const roofMat = netMat.clone();
roofMat.map = netTex.clone();
roofMat.map.repeat.set(8, 2);
const roof = new THREE.Mesh(
  new THREE.CylinderGeometry(1.6, 1.6, GOAL_HALF_W * 2, 18, 1, true, Math.PI / 2, Math.PI / 2),
  roofMat
);
roof.rotation.z = Math.PI / 2;
roof.position.set(0, GOAL_H - 1.6, GOAL_Z);
goal.add(roof);
// side nets
[-GOAL_HALF_W, GOAL_HALF_W].forEach((x) => {
  const side = new THREE.Mesh(new THREE.PlaneGeometry(1.6, GOAL_H - 1.5), netMat);
  side.rotation.y = Math.PI / 2;
  side.position.set(x, (GOAL_H - 1.5) / 2, GOAL_Z - 0.8);
  goal.add(side);
});
scene.add(goal);

// ---------- The keeper tower: big striped guy with a small green keeper on his head ----------
function makeKeeperTower() {
  const k = new THREE.Group();

  // bottom: the big guy with the huge arms
  const shoe1 = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.5), toon(0x1c1c1c));
  shoe1.position.set(-0.24, 0.08, 0.05); k.add(shoe1);
  const shoe2 = shoe1.clone(); shoe2.position.x = 0.24; k.add(shoe2);
  [-0.22, 0.22].forEach((x) => {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.5, 8), toon(SKIN));
    leg.position.set(x, 0.42, 0);
    k.add(leg);
  });
  const shorts = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.42, 0.44), toon(0x1c1c1c));
  shorts.position.y = 0.85;
  outline(shorts, 0x000000, 1.08);
  k.add(shorts);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.95, 0.5), new THREE.MeshToonMaterial({ map: stripeTex, gradientMap }));
  torso.position.y = 1.55;
  outline(torso, NAVY, 1.07);
  k.add(torso);
  [-1, 1].forEach((s) => {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.62, 4, 10), toon(SKIN));
    arm.position.set(s * 0.75, 1.45, 0.05);
    arm.rotation.z = s * 0.5;
    outline(arm, SKIN_DARK, 1.1);
    k.add(arm);
  });
  const head1 = new THREE.Mesh(new THREE.SphereGeometry(0.34, 14, 12), toon(SKIN));
  head1.position.y = 2.35;
  outline(head1, SKIN_DARK, 1.08);
  k.add(head1);
  const hair1 = new THREE.Mesh(new THREE.SphereGeometry(0.35, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.45), toon(0x1c1c1c));
  hair1.position.y = 2.37;
  k.add(hair1);

  // top: the little green keeper standing on his head, arms spread wide
  [-0.13, 0.13].forEach((x) => {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.36, 8), toon(SKIN));
    leg.position.set(x, 2.88, 0);
    k.add(leg);
  });
  const shorts2 = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.26, 0.3), toon(0x2f3d23));
  shorts2.position.y = 3.15;
  k.add(shorts2);
  const torso2 = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.65, 0.34), toon(SHIRT_GREEN));
  torso2.position.y = 3.6;
  outline(torso2, SHIRT_GREEN_DARK, 1.09);
  k.add(torso2);
  [-1, 1].forEach((s) => {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.55, 4, 8), toon(SKIN));
    arm.rotation.z = Math.PI / 2 - s * 0.12;
    arm.position.set(s * 0.68, 3.78, 0);
    k.add(arm);
    const glove = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), toon(0xffffff));
    glove.position.set(s * 1.05, 3.82, 0);
    outline(glove, RET_RED, 1.12);
    k.add(glove);
  });
  const head2 = new THREE.Mesh(new THREE.SphereGeometry(0.27, 14, 12), toon(SKIN));
  head2.position.y = 4.1;
  outline(head2, SKIN_DARK, 1.08);
  k.add(head2);
  const hair2 = new THREE.Mesh(new THREE.SphereGeometry(0.28, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.4), toon(ORANGE_DARK));
  hair2.position.y = 4.12;
  k.add(hair2);

  k.add(makeShadow(0.9));
  return k;
}
const keeper = makeKeeperTower();
keeper.position.set(0, 0, GOAL_Z + 0.7);
scene.add(keeper);

// ---------- The header player (back to camera) ----------
function makeHeader() {
  const p = new THREE.Group();
  const shoe1 = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.14, 0.4), toon(0x1c1c1c));
  shoe1.position.set(-0.17, 0.07, 0.03); p.add(shoe1);
  const shoe2 = shoe1.clone(); shoe2.position.x = 0.17; p.add(shoe2);
  [-0.16, 0.16].forEach((x) => {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.45, 8), toon(SKIN));
    leg.position.set(x, 0.37, 0);
    p.add(leg);
  });
  const shorts = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.3, 0.34), toon(0x1c1c1c));
  shorts.position.y = 0.72;
  p.add(shorts);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.72, 0.38), toon(ORANGE));
  torso.position.y = 1.22;
  outline(torso, ORANGE_DARK, 1.08);
  p.add(torso);
  [-1, 1].forEach((s) => {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.5, 4, 8), toon(SKIN));
    arm.position.set(s * 0.45, 1.2, 0);
    arm.rotation.z = s * 0.35;
    p.add(arm);
  });
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 14, 12), toon(SKIN));
  head.position.y = 1.95;
  outline(head, SKIN_DARK, 1.08);
  p.add(head);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.33, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.42), toon(0x4a2c14));
  hair.position.y = 1.97;
  p.add(hair);
  p.add(makeShadow(0.55));
  p.userData.headY = 1.95;
  return p;
}
const player = makeHeader();
player.position.set(0, 0, -1);
scene.add(player);

// ---------- The ball ----------
const ball = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 20, 16), new THREE.MeshToonMaterial({ map: soccerTex, gradientMap }));
outline(ball, INK, 1.06);
scene.add(ball);
const ballShadow = makeShadow(0.5);
scene.add(ballShadow);

// landing marker: where the lob will arrive
const landRing = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.06, 8, 24), flat(ORANGE));
landRing.rotation.x = -Math.PI / 2;
landRing.position.y = 0.03;
scene.add(landRing);

// ---------- Aim reticle on the goal ----------
const reticle = new THREE.Group();
const ring = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.07, 8, 24), flat(RET_RED));
reticle.add(ring);
[[0.62, 0.08], [0.08, 0.62]].forEach(([w, h]) => {
  const bar = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.05), flat(RET_RED));
  reticle.add(bar);
});
reticle.position.set(0, 2.2, GOAL_Z + 0.25);
scene.add(reticle);

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
const whistle = () => { if (audioCtx) { beep(2100, 0, 0.12, 'square', 0.08); beep(1700, 0.14, 0.18, 'square', 0.08); } };
const headerSound = () => { if (audioCtx) { beep(300, 0, 0.06, 'triangle', 0.18); beep(520, 0.04, 0.1, 'triangle', 0.12); } };
const goalSound = () => { if (audioCtx) [523, 659, 784, 1047, 1319].forEach((f, i) => beep(f, i * 0.07, 0.22)); };
const saveSound = () => { if (audioCtx) { beep(180, 0, 0.12, 'square', 0.15); beep(120, 0.1, 0.2, 'square', 0.12); } };
const missSound = () => { if (audioCtx) { beep(240, 0, 0.15, 'sawtooth', 0.1); beep(150, 0.14, 0.25, 'sawtooth', 0.1); } };

// ---------- Game state ----------
const keys = new Set();
const state = {
  phase: 'idle', // idle | incoming | headed | result
  goals: 0,
  kicks: 0,
  ballVel: new THREE.Vector3(),
  headPoint: new THREE.Vector3(0, 2.45, -1),
  headed: false,
  jumpT: 99,
  keeperTargetX: 0,
  keeperReact: 0,
  resultT: 0,
  netPulse: 0,
  elapsed: 0,
};

const scoreEl = document.getElementById('score');
const kicksEl = document.getElementById('kicks');
const msgEl = document.getElementById('msg');
const introEl = document.getElementById('intro');

function setScore() {
  scoreEl.textContent = `גולים: ${state.goals}`;
  kicksEl.textContent = `בעיטות: ${state.kicks}`;
}

let msgTimer = null;
function flash(text, bad = false) {
  msgEl.textContent = text;
  msgEl.classList.toggle('bad', bad);
  msgEl.classList.add('show');
  clearTimeout(msgTimer);
  msgTimer = setTimeout(() => msgEl.classList.remove('show'), 1000);
}

// ---------- Round flow ----------
function newBall() {
  state.phase = 'incoming';
  state.headed = false;
  state.jumpT = 99;
  const hx = (Math.random() * 2 - 1) * 1.1;
  state.headPoint.set(hx, 2.35 + Math.random() * 0.3, -1);
  const start = new THREE.Vector3((Math.random() * 2 - 1) * 3, 5.5 + Math.random() * 1.5, 12);
  ball.position.copy(start);
  state.ballVel.copy(state.headPoint).sub(start).divideScalar(FLIGHT_T);
  state.ballVel.y += 0.5 * G * FLIGHT_T;
  landRing.position.set(hx, 0.03, -1);
  landRing.visible = true;
  whistle();
}

function resolveKick(kind) {
  state.kicks += 1;
  if (kind === 'goal') {
    state.goals += 1;
    state.netPulse = 1;
    goalSound();
    flash('גול!!! ⚽ +1');
  } else if (kind === 'save') {
    saveSound();
    flash('השוער תפס! 🧤', true);
  } else if (kind === 'out') {
    missSound();
    flash('החוצה! 😅', true);
  } else {
    missSound();
    flash('פספוס! 🙈', true);
  }
  setScore();
  state.phase = 'result';
  state.resultT = 0;
  landRing.visible = false;
}

function startGame() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  state.goals = 0;
  state.kicks = 0;
  setScore();
  introEl.classList.add('hidden');
  newBall();
}

document.getElementById('startBtn').addEventListener('click', startGame);
window.addEventListener('keydown', (e) => {
  keys.add(e.code);
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  if (state.phase === 'idle' && (e.code === 'Enter' || e.code === 'Space')) {
    if (!introEl.classList.contains('hidden')) startGame();
    return;
  }
  // the header! jump, and if the ball is close enough — boom
  if (e.code === 'Space' && state.phase === 'incoming') {
    if (state.jumpT > 0.55) state.jumpT = 0;
    if (!state.headed && ball.position.distanceTo(new THREE.Vector3(player.position.x, player.userData.headY + 0.5, player.position.z)) < HEAD_REACH) {
      doHeader();
    }
  }
});
window.addEventListener('keyup', (e) => keys.delete(e.code));

function doHeader() {
  state.headed = true;
  state.phase = 'headed';
  headerSound();
  const target = reticle.position.clone();
  const tau = ball.position.distanceTo(target) / 24;
  state.ballVel.copy(target).sub(ball.position).divideScalar(tau);
  state.ballVel.y += 0.5 * G * tau;
  // the keeper picks his dive: sharp when he's warmed up, sloppy early on
  const err = Math.max(0, 2.2 - state.goals * 0.2) * (Math.random() * 2 - 1);
  state.keeperTargetX = THREE.MathUtils.clamp(target.x + err, -GOAL_HALF_W + 0.6, GOAL_HALF_W - 0.6);
  state.keeperReact = Math.max(0.08, 0.36 - state.goals * 0.015);
  landRing.visible = false;
}

// ---------- Main loop ----------
const clock = new THREE.Clock();

function update(dt) {
  state.elapsed += dt;

  // aim with arrows, any time
  const ax = (keys.has('ArrowRight') || keys.has('KeyD') ? 1 : 0) - (keys.has('ArrowLeft') || keys.has('KeyA') ? 1 : 0);
  const ay = (keys.has('ArrowUp') || keys.has('KeyW') ? 1 : 0) - (keys.has('ArrowDown') || keys.has('KeyS') ? 1 : 0);
  reticle.position.x = THREE.MathUtils.clamp(reticle.position.x + ax * 9 * dt, -GOAL_HALF_W + 0.6, GOAL_HALF_W - 0.6);
  reticle.position.y = THREE.MathUtils.clamp(reticle.position.y + ay * 9 * dt, 0.75, GOAL_H - 0.35);
  reticle.rotation.z += dt * 1.5;

  // player jump animation
  state.jumpT += dt;
  player.position.y = state.jumpT < 0.55 ? Math.sin((Math.PI * state.jumpT) / 0.55) * 1.4 : 0;

  if (state.phase === 'incoming' || state.phase === 'headed' || state.phase === 'result') {
    // ball physics
    state.ballVel.y -= G * dt;
    ball.position.addScaledVector(state.ballVel, dt);
    ball.rotation.x -= state.ballVel.z * dt * 0.8;
    ball.rotation.z += state.ballVel.x * dt * 0.8;
    if (ball.position.y < BALL_R && state.phase !== 'incoming') {
      ball.position.y = BALL_R;
      state.ballVel.y = Math.abs(state.ballVel.y) * 0.4;
      state.ballVel.x *= 0.9;
      state.ballVel.z *= 0.9;
    }
    ballShadow.position.set(ball.position.x, 0.025, ball.position.z);
    const sh = THREE.MathUtils.clamp(1 - ball.position.y * 0.08, 0.3, 1);
    ballShadow.scale.setScalar(sh);
  }

  if (state.phase === 'incoming') {
    // player slides a little toward the landing spot, like getting ready
    player.position.x += (state.headPoint.x - player.position.x) * (1 - Math.exp(-3 * dt));
    // keeper shuffles side to side, waiting
    keeper.position.x += (Math.sin(state.elapsed * 1.2) * 0.7 - keeper.position.x) * (1 - Math.exp(-2 * dt));
    keeper.rotation.z *= Math.exp(-4 * dt);
    // pulse the landing ring
    landRing.scale.setScalar(1 + Math.sin(state.elapsed * 7) * 0.12);
    // missed it?
    if (ball.position.y < BALL_R || ball.position.z < player.position.z - 2.5) {
      resolveKick('miss');
    }
  } else if (state.phase === 'headed') {
    // keeper dives after his reaction time
    state.keeperReact -= dt;
    if (state.keeperReact <= 0) {
      const dx = state.keeperTargetX - keeper.position.x;
      const step = (3.5 + Math.min(8.5, state.goals * 0.55)) * dt;
      keeper.position.x += THREE.MathUtils.clamp(dx, -step, step);
      keeper.rotation.z += (THREE.MathUtils.clamp(-dx * 0.5, -0.75, 0.75) - keeper.rotation.z) * (1 - Math.exp(-6 * dt));
    }
    // crossing the goal line?
    if (ball.position.z <= GOAL_Z + BALL_R) {
      const bx = ball.position.x, by = ball.position.y;
      const inGoal = Math.abs(bx) < GOAL_HALF_W - 0.15 && by < GOAL_H - 0.1;
      const savedByKeeper = Math.abs(bx - keeper.position.x) < 1.5 && by < 3.55;
      if (inGoal && savedByKeeper) {
        state.ballVel.z = Math.abs(state.ballVel.z) * 0.35;
        state.ballVel.x += (Math.random() - 0.5) * 4;
        state.ballVel.y = Math.max(state.ballVel.y, 2);
        resolveKick('save');
      } else if (inGoal) {
        state.ballVel.multiplyScalar(0.4); // into the net
        resolveKick('goal');
      } else {
        resolveKick('out');
      }
    }
    // sailed over everything?
    if (ball.position.z < GOAL_Z - 3 || ball.position.y < BALL_R) {
      if (state.phase === 'headed') resolveKick(ball.position.y < BALL_R ? 'out' : 'out');
    }
  } else if (state.phase === 'result') {
    state.resultT += dt;
    // ball settles into the net
    if (ball.position.z < GOAL_Z - 1.4) {
      ball.position.z = GOAL_Z - 1.4;
      state.ballVel.z = 0;
    }
    // keeper walks back to the middle
    keeper.position.x *= Math.exp(-2 * dt);
    keeper.rotation.z *= Math.exp(-3 * dt);
    if (state.resultT > 1.4) newBall();
  }

  // goal net ripple on a goal
  if (state.netPulse > 0) {
    state.netPulse = Math.max(0, state.netPulse - dt * 2);
    const s = 1 + Math.sin(state.netPulse * Math.PI) * 0.06;
    netBack.scale.set(s, s, 1);
  }
}

function tick() {
  requestAnimationFrame(tick);
  update(Math.min(clock.getDelta(), 0.05));
  renderer.render(scene, camera);
}

ball.position.set(0, BALL_R, 2);
landRing.visible = false;
setScore();
tick();

// debugging hook for tests
window.__pendel = { state, ball, keeper, player, reticle, startGame, update, render: () => renderer.render(scene, camera) };
