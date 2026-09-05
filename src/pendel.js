import * as THREE from 'three';
import { createApp } from './kit/app.js';
import { toonMat, flatMat, spriteMat, noOutline, blobShadow, canvasTex, paperTexture, INK, clamp, smooth } from './kit/toon.js';
import { createInput } from './kit/input.js';
import { createHud } from './kit/hud.js';
import { beep, noise, chord } from './kit/audio.js';

// The drawing (drawings/header-penalties.jpg): a domed goal, a green goalkeeper with
// his arms flung wide and polka-dot gloves standing in it, and — nearer to us — a big
// kid in a blue-and-white striped shirt with huge arms, the ball on his head. The kid
// wrote: "there's a goal with a keeper in it, penalties by heading, the ball comes
// lobbed from behind, every goal is one point."

// ---------- Marker palette ----------
const GRASS_GREEN = 0x2b7a1f;
const SHIRT_GREEN = 0x69a80f;
const SHIRT_GREEN_DARK = 0x40700a;
const SHORTS_GREEN = 0x2f5a1f;
const NAVY = 0x27408b;
const SKIN = 0xf2b09a;
const SKIN_DARK = 0xc97f66;
const RET_RED = 0xd8281c;
const ORANGE = 0xe07612;
const ORANGE_DARK = 0xa9560a;
const SHOE_BLUE = 0x2b4bd7;
const SHOE_BLUE_DARK = 0x1d35a8;

// ---------- Constants ----------
const GOAL_Z = -19;
const GOAL_HALF_W = 6;
const GOAL_H = 4.6;
const G = 18;                 // cartoon gravity
const BALL_R = 0.5;
const HEAD_REACH = 2.3;       // how close the ball must be to head it at all
const PERFECT_DIST = 0.95;    // ...and this close for a PERFECT header
const FLIGHT_T = 1.7;         // seconds for the lob to arrive
const HEAD_Z = -1;
const HEAD_Y = 2.42;          // the header's head (he's a big kid)
const KICKS_PER_ROUND = 5;
const LEAN_AT = 1.05;         // seconds into the lob when the keeper shows his guess
const KEEPER_MAX_X = GOAL_HALF_W - 0.6;
const KEEPER_JUMP = 2.3;      // how high the keeper can leap

// ---------- App ----------
const app = createApp({ fov: 55, fog: { near: 55, far: 130 } });
const { scene, camera, juice } = app;
camera.position.set(0, 4.3, 7.8);
camera.lookAt(0, 2.2, GOAL_Z);
const input = createInput();
app.input = input;
const hud = createHud(app, { gameId: 'pendel', music: { seed: 2, bpm: 96 } });
if (input.touch) input.touch.setLabels({ a: '🦘', b: '' });

// ---------- Hand-drawn textures ----------
const paperTex = paperTexture();
paperTex.repeat.set(12, 12);
const netTex = canvasTex(128, (g) => {
  g.clearRect(0, 0, 128, 128);
  g.strokeStyle = '#2a2a2a';
  g.lineWidth = 2.5;
  for (let i = 0; i <= 128; i += 14) {
    g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 128); g.stroke();
    g.beginPath(); g.moveTo(0, i); g.lineTo(128, i); g.stroke();
  }
}, { wrap: true });
const stripesOf = (color) => canvasTex(64, (g) => {
  g.fillStyle = '#f4f4f0';
  g.fillRect(0, 0, 64, 64);
  g.fillStyle = color;
  for (let x = 0; x < 64; x += 16) g.fillRect(x, 0, 8, 64);
});
const stripeBlue = stripesOf('#27408b');
const stripeOrange = stripesOf('#e07612');
const dotsTex = canvasTex(64, (g) => { // the polka-dot gloves
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 64, 64);
  g.fillStyle = '#d8281c';
  for (let i = 0; i < 9; i++) {
    g.beginPath();
    g.arc(8 + (i % 3) * 22 + (i % 2) * 5, 10 + Math.floor(i / 3) * 20, 4.5, 0, Math.PI * 2);
    g.fill();
  }
});
const shirtNumberTex = canvasTex(128, (g) => { // green shirt with the kid's scribbled "3"
  g.fillStyle = '#69a80f';
  g.fillRect(0, 0, 128, 128);
  g.strokeStyle = '#2f5a1f';
  g.lineWidth = 9;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(48, 36); g.lineTo(78, 36); g.lineTo(58, 60); g.lineTo(80, 62); g.lineTo(80, 88); g.lineTo(46, 90);
  g.stroke();
});
const soccerTex = canvasTex(128, (g) => {
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
});

// ---------- The paper pitch ----------
const ground = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), noOutline(new THREE.MeshBasicMaterial({ map: paperTex })));
ground.rotation.x = -Math.PI / 2;
scene.add(ground);
[[0, GOAL_Z + 4.5, 20, 0.18, 0.008], [-10, GOAL_Z + 9.75, 0.18, 10.7, 0.006], [10, GOAL_Z + 9.75, 0.18, 10.7, -0.006]].forEach(([x, z, w, d, tilt]) => {
  const line = new THREE.Mesh(new THREE.BoxGeometry(w, 0.02, d), flatMat(GRASS_GREEN));
  line.position.set(x, 0.01, z);
  line.rotation.y = tilt;
  scene.add(line);
});

// ---------- The goal: posts + domed net, like the drawing ----------
const goal = new THREE.Group();
const postMat = toonMat(INK);
[-GOAL_HALF_W, GOAL_HALF_W].forEach((x) => {
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, GOAL_H, 10), postMat);
  post.position.set(x, GOAL_H / 2, GOAL_Z);
  goal.add(post);
});
const crossbar = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, GOAL_HALF_W * 2 + 0.3, 10), postMat);
crossbar.rotation.z = Math.PI / 2;
crossbar.position.set(0, GOAL_H, GOAL_Z);
goal.add(crossbar);
const netMat = spriteMat(netTex, { side: THREE.DoubleSide });
netMat.map.repeat.set(8, 3);
const netBack = new THREE.Mesh(new THREE.PlaneGeometry(GOAL_HALF_W * 2, GOAL_H - 1.5), netMat);
netBack.position.set(0, (GOAL_H - 1.5) / 2, GOAL_Z - 1.6);
goal.add(netBack);
const roofMat = spriteMat(netTex.clone(), { side: THREE.DoubleSide });
roofMat.map.needsUpdate = true;
roofMat.map.repeat.set(8, 2);
const roof = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, GOAL_HALF_W * 2, 18, 1, true, Math.PI / 2, Math.PI / 2), roofMat);
roof.rotation.z = Math.PI / 2;
roof.position.set(0, GOAL_H - 1.6, GOAL_Z);
goal.add(roof);
[-GOAL_HALF_W, GOAL_HALF_W].forEach((x) => {
  const side = new THREE.Mesh(new THREE.PlaneGeometry(1.6, GOAL_H - 1.5), netMat);
  side.rotation.y = Math.PI / 2;
  side.position.set(x, (GOAL_H - 1.5) / 2, GOAL_Z - 0.8);
  goal.add(side);
});
scene.add(goal);

// ---------- The keeper: the green kid with his arms flung wide ----------
// His SILHOUETTE is what saves shots (see keeperSaves): body boxes in keeper-local
// space, moved with his dive and leap, so a shot is only safe where he isn't.
const SILHOUETTE = [
  // [half-width, y from, y to]
  [0.42, 0.0, 2.1],  // shoes, legs, shorts, shirt and head
  [1.55, 1.25, 1.75], // the wide arms and the polka-dot gloves
];
function makeKeeper() {
  const k = new THREE.Group();
  const skin = toonMat(SKIN, { outline: SKIN_DARK });
  const shoe = toonMat(SHOE_BLUE, { outline: SHOE_BLUE_DARK });
  [-0.17, 0.17].forEach((x) => {
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.16, 0.44), shoe);
    s.position.set(x, 0.08, 0.04);
    k.add(s);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.55, 8), skin);
    leg.position.set(x, 0.42, 0);
    k.add(leg);
  });
  const shorts = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.36, 0.36), toonMat(SHORTS_GREEN, { outline: 0x1c3a12 }));
  shorts.position.y = 0.86;
  k.add(shorts);
  const shirt = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.8, 0.4), toonMat(0xffffff, { map: shirtNumberTex, outline: SHIRT_GREEN_DARK }));
  shirt.position.y = 1.44;
  k.add(shirt);
  // arms straight out to the sides, gloves open — the pose in the drawing
  [-1, 1].forEach((s) => {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.8, 4, 8), skin);
    arm.rotation.z = Math.PI / 2 - s * 0.08;
    arm.position.set(s * 0.86, 1.52, 0);
    k.add(arm);
    const glove = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 10), toonMat(0xffffff, { map: dotsTex, outline: RET_RED }));
    glove.position.set(s * 1.42, 1.55, 0.02);
    glove.scale.set(1, 1.1, 0.7);
    k.add(glove);
  });
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 12), skin);
  head.position.y = 2.08;
  k.add(head);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.31, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.42), toonMat(ORANGE, { outline: ORANGE_DARK }));
  hair.position.y = 2.11;
  k.add(hair);
  const ink = flatMat(INK);
  [-0.1, 0.1].forEach((x) => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), ink);
    eye.position.set(x, 2.12, 0.28);
    k.add(eye);
  });
  const smile = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.014, 6, 12, Math.PI), ink);
  smile.rotation.z = Math.PI;
  smile.position.set(0, 2.01, 0.28);
  k.add(smile);
  k.add(blobShadow(0.75));
  return k;
}
const keeperG = makeKeeper();
keeperG.position.set(0, 0, GOAL_Z + 0.7);
scene.add(keeperG);

// ---------- The header: the big kid in the striped shirt, back to camera ----------
const shirtP1 = toonMat(0xffffff, { map: stripeBlue, outline: NAVY });
const shirtP2 = toonMat(0xffffff, { map: stripeOrange, outline: ORANGE_DARK });
let torsoMesh = null;
function makeHeader() {
  const p = new THREE.Group();
  const skin = toonMat(SKIN, { outline: SKIN_DARK });
  const black = toonMat(0x1c1c1c, { outline: 0x000000 });
  [-0.24, 0.24].forEach((x) => {
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.5), black);
    shoe.position.set(x, 0.08, 0.05);
    p.add(shoe);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.62, 8), skin);
    leg.position.set(x, 0.47, 0);
    p.add(leg);
  });
  const shorts = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.44, 0.46), black);
  shorts.position.y = 0.98;
  p.add(shorts);
  const badge = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 0.03), flatMat(0xf2c414)); // the little yellow logo on the shorts
  badge.position.set(0.2, 1.0, -0.24);
  p.add(badge);
  torsoMesh = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.95, 0.52), shirtP1);
  torsoMesh.position.y = 1.68;
  p.add(torsoMesh);
  // the enormous arms, hanging down and out
  [-1, 1].forEach((s) => {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.21, 0.72, 4, 10), skin);
    arm.position.set(s * 0.78, 1.42, 0.05);
    arm.rotation.z = s * 0.42;
    p.add(arm);
  });
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.34, 14, 12), skin);
  head.position.y = HEAD_Y;
  p.add(head);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.35, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.45), black);
  hair.position.y = HEAD_Y + 0.02;
  p.add(hair);
  p.add(blobShadow(0.75));
  return p;
}
const player = makeHeader();
player.position.set(0, 0, HEAD_Z);
scene.add(player);
const setShirt = (n) => { torsoMesh.material = n === 2 ? shirtP2 : shirtP1; };

// ---------- The ball ----------
const ball = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 20, 16), toonMat(0xffffff, { map: soccerTex, outline: INK }));
scene.add(ball);
const ballShadow = blobShadow(0.5, { y: 0.025 });
scene.add(ballShadow);
const landRing = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.06, 8, 24), flatMat(ORANGE));
landRing.rotation.x = -Math.PI / 2;
landRing.position.y = 0.03;
scene.add(landRing);

// ---------- Aim reticle on the goal ----------
const reticle = new THREE.Group();
reticle.add(new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.07, 8, 24), flatMat(RET_RED)));
[[0.62, 0.08], [0.08, 0.62]].forEach(([w, h]) => reticle.add(new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.05), flatMat(RET_RED))));
reticle.position.set(0, 2.2, GOAL_Z + 0.25);
scene.add(reticle);

// ---------- Sounds ----------
const whistle = () => { beep(2100, 0, 0.12, 'square', 0.08); beep(1700, 0.14, 0.18, 'square', 0.08); };
const headerSound = (perfect) => {
  beep(300, 0, 0.06, 'triangle', 0.18);
  beep(perfect ? 760 : 520, 0.04, 0.1, 'triangle', 0.12);
  if (perfect) beep(1200, 0.1, 0.14, 'sine', 0.1);
};
const goalSound = () => chord([523, 659, 784, 1047, 1319], 0.07, 0.22);
const saveSound = () => { beep(180, 0, 0.12, 'square', 0.15); beep(120, 0.1, 0.2, 'square', 0.12); noise(0.12, 500, 0.12); };
const missSound = () => { beep(240, 0, 0.15, 'sawtooth', 0.1); beep(150, 0.14, 0.25, 'sawtooth', 0.1); };
const jumpSound = () => beep(280, 0, 0.1, 'triangle', 0.1, 520);
const swapSound = () => chord([440, 554, 659], 0.09, 0.2, 'triangle');
const roundSound = (win) => (win
  ? chord([392, 494, 587, 784, 988], 0.13, 0.25, 'triangle', 0.14)
  : chord([330, 262, 208], 0.16, 0.3, 'sawtooth', 0.1));

// ---------- Game state ----------
const state = {
  phase: 'idle', // idle | incoming | headed | result | swap | over
  mode: '1p',    // 1p: five kicks against the CPU keeper · 2p: header vs keeper, then swap
  goals: 0,
  kicks: 0,
  round: 1,
  attacker: 1,
  keeperP: 2,
  scores: [0, 0],
  roundsPlayed: 0, // the CPU keeper gets sharper the longer you play
  ballVel: new THREE.Vector3(),
  headPoint: new THREE.Vector3(0, HEAD_Y + 0.5, HEAD_Z),
  jumpT: 99,
  flightT: 0,
  resultT: 0,
  netPulse: 0,
  elapsed: 0,
};
const keeper = {
  x: 0, y: 0, lean: 0, leanTarget: 0,
  guess: 0,          // -1 / 0 / 1: the side he's leaning toward
  guessShown: false,
  bluff: false,      // leaning one way, diving at the real ball — rare, more often when he's warmed up
  targetX: 0, targetY: 0, react: 0, dive: false,
  human: false,
  jumpT: 99,         // human keeper's leap
};
// keeper experience: goals this round plus rounds already played in this session
const sharpness = () => Math.min(1, (state.goals + state.roundsPlayed * 1.5) / 8);

function setScore() {
  hud.set('#score', `⚽ ${state.goals}`);
  hud.set('#kicks', `🦶 ${Math.min(state.kicks + 1, KICKS_PER_ROUND)}/${KICKS_PER_ROUND}`);
}
function whoText() {
  const a = state.attacker, k = state.keeperP;
  return `${a === 1 ? '🔵' : '🟠'} שחקן ${a} נוגח · ${k === 1 ? '🔵' : '🟠'} שחקן ${k} שוער`;
}

// ---------- Round flow ----------
function newBall() {
  state.phase = 'incoming';
  state.flightT = 0;
  state.jumpT = 99;
  keeper.guess = 0;
  keeper.guessShown = false;
  keeper.dive = false;
  const hx = (Math.random() * 2 - 1) * 1.1;
  state.headPoint.set(hx, HEAD_Y + 0.45 + Math.random() * 0.3, HEAD_Z);
  const start = new THREE.Vector3((Math.random() * 2 - 1) * 3, 6 + Math.random() * 1.5, 12);
  ball.position.copy(start);
  state.ballVel.copy(state.headPoint).sub(start).divideScalar(FLIGHT_T);
  state.ballVel.y += 0.5 * G * FLIGHT_T;
  landRing.position.set(hx, 0.03, HEAD_Z);
  landRing.visible = true;
  whistle();
}

const _head = new THREE.Vector3();
function tryHeader() {
  if (state.phase !== 'incoming') return false;
  if (state.jumpT > 0.55) state.jumpT = 0;
  _head.set(player.position.x, HEAD_Y + 0.5, player.position.z);
  const d = ball.position.distanceTo(_head);
  if (d < HEAD_REACH) { doHeader(d); return true; }
  return false;
}

// The header: a PERFECT press (ball right on the forehead) fires a fast, true shot;
// early or late presses go where you aimed but wobble up or down and fly slower.
function doHeader(dist) {
  state.phase = 'headed';
  const perfect = dist < PERFECT_DIST;
  const early = ball.position.z > state.headPoint.z + 0.6;
  headerSound(perfect);
  const target = reticle.position.clone();
  if (!perfect) target.y += early ? 0.55 : -0.45;
  const speed = perfect ? 30 : 22;
  const tau = ball.position.distanceTo(target) / speed;
  state.ballVel.copy(target).sub(ball.position).divideScalar(tau);
  state.ballVel.y += 0.5 * G * tau;
  if (perfect) {
    hud.flash('מושלם! ✨', { good: true, dur: 700 });
    juice.hitstop(0.07);
  }
  if (!keeper.human) cpuDive(target);
  landRing.visible = false;
}

// ---------- The CPU keeper: he guesses, he SHOWS his guess, then he commits ----------
function cpuLean() {
  // reads your reticle more often as he warms up; otherwise it's a coin flip
  const pRead = Math.min(0.85, 0.35 + sharpness() * 0.55);
  const retSide = Math.abs(reticle.position.x) < 1.2 ? 0 : Math.sign(reticle.position.x);
  keeper.guess = Math.random() < pRead ? retSide : [-1, 0, 1][Math.floor(Math.random() * 3)];
  keeper.bluff = Math.random() < Math.min(0.35, sharpness() * 0.45);
  keeper.guessShown = true;
  keeper.leanTarget = -keeper.guess * 0.32;
}
function cpuDive(target) {
  const side = Math.abs(target.x) < 1.2 ? 0 : Math.sign(target.x);
  const sharp = sharpness();
  if (keeper.bluff || keeper.guess === side) {
    // guessed right: dives at the ball, tighter every goal
    keeper.targetX = clamp(target.x + (Math.random() * 2 - 1) * (1.3 - sharp * 1.0), -KEEPER_MAX_X, KEEPER_MAX_X);
    keeper.targetY = target.y > 2.0 ? clamp(target.y - 1.5 + (Math.random() - 0.5) * 0.4, 0, KEEPER_JUMP) : 0;
  } else {
    // guessed wrong: committed to his side, the other corner is open
    keeper.targetX = clamp(keeper.guess * (2.5 + sharp * 2.5) + (Math.random() * 2 - 1) * 0.8, -KEEPER_MAX_X, KEEPER_MAX_X);
    keeper.targetY = Math.random() < 0.5 ? 0 : 1.2;
  }
  keeper.react = Math.max(0.05, 0.3 - sharp * 0.2);
  keeper.dive = true;
}

// Does the keeper's silhouette cover this point on the goal line? The ball centre is
// moved into keeper space (shifted by his dive, un-leaned about his feet) and tested
// against the body boxes, grown by part of the ball radius.
function keeperSaves(bx, by) {
  const c = Math.cos(-keeper.lean), s = Math.sin(-keeper.lean);
  const x0 = bx - keeper.x, y0 = by - keeper.y;
  const lx = x0 * c - y0 * s;
  const ly = x0 * s + y0 * c;
  const r = BALL_R * 0.55;
  return SILHOUETTE.some(([hw, ya, yb]) => Math.abs(lx) <= hw + r && ly >= ya - r && ly <= yb + r);
}

function resolveKick(kind) {
  state.kicks += 1;
  if (kind === 'goal') {
    state.goals += 1;
    state.netPulse = 1;
    goalSound();
    hud.flash('גול!!! ⚽');
    juice.pop(_head.set(ball.position.x, ball.position.y + 0.8, ball.position.z), '+1', { color: '#2b7a1f', size: 38 });
    juice.shake(0.25);
    hud.pop('#score');
  } else if (kind === 'save') {
    saveSound();
    hud.flash('השוער תפס! 🧤', { bad: true });
    juice.shake(0.35);
    juice.hitstop(0.05);
  } else if (kind === 'out') {
    missSound();
    hud.flash('החוצה! 😅', { bad: true });
  } else {
    missSound();
    hud.flash('פספוס! 🙈', { bad: true });
  }
  setScore();
  state.phase = 'result';
  state.resultT = 0;
  landRing.visible = false;
  keeper.dive = false;
}

function endRound() {
  state.roundsPlayed += 1;
  if (state.mode === '2p') {
    state.scores[state.attacker - 1] = state.goals;
    if (state.round === 1) {
      state.round = 2;
      [state.attacker, state.keeperP] = [state.keeperP, state.attacker];
      state.goals = 0;
      state.kicks = 0;
      setScore();
      setShirt(state.attacker);
      hud.set('#who', whoText());
      hud.flash('מתחלפים! 🔁', { good: true, dur: 1400 });
      swapSound();
      state.phase = 'swap';
      state.resultT = 0;
      return;
    }
    showOver2p();
  } else {
    showOver1p();
  }
}
function showOver1p() {
  state.phase = 'over';
  hud.stopMusic();
  const g = state.goals;
  const best = hud.best('pendel-best', g);
  roundSound(g >= 3);
  hud.set('#goTitle', g >= KICKS_PER_ROUND ? '🏆 סיבוב מושלם!' : g >= 3 ? '🎉 כל הכבוד!' : '🏁 נגמר הסיבוב!');
  hud.set('#finalScore', `${g} מתוך ${KICKS_PER_ROUND} גולים`);
  hud.set('#finalStars', '⭐'.repeat(g) + '☆'.repeat(KICKS_PER_ROUND - g));
  hud.set('#finalDetail', state.roundsPlayed > 1 ? `השוער כבר מכיר אתכם... סיבוב ${state.roundsPlayed}` : '');
  hud.set('#bestScore', `השיא שלכם: ${best} גולים`);
  hud.show('#gameover');
}
function showOver2p() {
  state.phase = 'over';
  hud.stopMusic();
  const [a, b] = state.scores;
  roundSound(true);
  hud.set('#goTitle', a === b ? '🤝 תיקו!' : a > b ? '🔵 שחקן 1 ניצח!' : '🟠 שחקן 2 ניצח!');
  hud.set('#finalScore', `${a} : ${b}`);
  hud.set('#finalStars', '');
  hud.set('#finalDetail', `🔵 שחקן 1 — ${a} גולים · 🟠 שחקן 2 — ${b} גולים`);
  hud.set('#bestScore', '');
  hud.show('#gameover');
}

function startGame(mode = '1p') {
  state.mode = mode;
  input.setTwoPlayer(mode === '2p');
  keeper.human = mode === '2p';
  state.goals = 0;
  state.kicks = 0;
  state.round = 1;
  state.attacker = 1;
  state.keeperP = 2;
  state.scores = [0, 0];
  keeper.x = 0;
  keeper.y = 0;
  keeper.lean = 0;
  keeper.jumpT = 99;
  setShirt(1);
  setScore();
  if (mode === '2p') { hud.set('#who', whoText()); hud.show('#who'); } else hud.hide('#who');
  hud.hide('#intro');
  hud.hide('#gameover');
  hud.startMusic();
  newBall();
}
hud.bind({
  start: () => startGame('1p'),
  start2: () => startGame('2p'),
  restart: () => startGame(state.mode),
});

// ---------- Main loop ----------
const _axis = { x: 0, z: 0 };
const _axis2 = { x: 0, z: 0 };

function updateKeeper(dt) {
  const sharp = sharpness();
  const live = state.phase === 'incoming' || state.phase === 'headed';
  if (keeper.human && live) {
    const kp = input.p(state.keeperP);
    const ax = kp.axis(_axis2);
    keeper.x = clamp(keeper.x + ax.x * 7.5 * dt, -KEEPER_MAX_X, KEEPER_MAX_X);
    keeper.lean += (clamp(-ax.x * 0.55, -0.6, 0.6) - keeper.lean) * smooth(6, dt);
    if (kp.consume('a') && keeper.jumpT > 0.6) { keeper.jumpT = 0; jumpSound(); }
    keeper.jumpT += dt;
    keeper.y = keeper.jumpT < 0.6 ? Math.sin((Math.PI * keeper.jumpT) / 0.6) * 2.0 : 0;
  } else if (state.phase === 'incoming' || state.phase === 'idle') {
    if (state.phase === 'incoming' && state.flightT >= LEAN_AT && !keeper.guessShown) cpuLean();
    const want = keeper.guessShown ? keeper.guess * 0.7 : Math.sin(state.elapsed * 1.2) * 0.7;
    keeper.x += (want - keeper.x) * smooth(3, dt);
    keeper.lean += ((keeper.guessShown ? keeper.leanTarget : 0) - keeper.lean) * smooth(6, dt);
    keeper.y *= Math.exp(-6 * dt);
  } else if (state.phase === 'headed' && keeper.dive) {
    keeper.react -= dt;
    if (keeper.react <= 0) {
      const dx = keeper.targetX - keeper.x;
      const step = (6 + sharp * 7) * dt;
      keeper.x += clamp(dx, -step, step);
      keeper.y += clamp(keeper.targetY - keeper.y, -9 * dt, 9 * dt);
      keeper.lean += (clamp(-dx * 0.6, -1.0, 1.0) - keeper.lean) * smooth(7, dt);
    }
  } else {
    // result / swap / over: land and walk back to the middle
    keeper.x *= Math.exp(-2 * dt);
    keeper.y *= Math.exp(-5 * dt);
    keeper.lean *= Math.exp(-3 * dt);
  }
  keeperG.position.x = keeper.x;
  keeperG.position.y = keeper.y;
  keeperG.rotation.z = keeper.lean;
}

function update(dt) {
  state.elapsed += dt;

  // aim any time during a round
  if (state.phase !== 'idle' && state.phase !== 'over') {
    const ax = input.p(state.attacker).axis(_axis);
    reticle.position.x = clamp(reticle.position.x + ax.x * 9 * dt, -GOAL_HALF_W + 0.6, GOAL_HALF_W - 0.6);
    reticle.position.y = clamp(reticle.position.y - ax.z * 9 * dt, 0.75, GOAL_H - 0.35);
  }
  reticle.rotation.z += dt * 1.5;

  // player jump animation
  state.jumpT += dt;
  player.position.y = state.jumpT < 0.55 ? Math.sin((Math.PI * state.jumpT) / 0.55) * 1.4 : 0;

  if (state.phase === 'incoming' && input.p(state.attacker).consume('a')) tryHeader();

  if (state.phase === 'incoming' || state.phase === 'headed' || state.phase === 'result') {
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
    ballShadow.scale.setScalar(0.5 * clamp(1 - ball.position.y * 0.08, 0.3, 1));
  }

  if (state.phase === 'incoming') {
    state.flightT += dt;
    // the header slides under the landing spot, getting ready
    player.position.x += (state.headPoint.x - player.position.x) * smooth(3, dt);
    landRing.scale.setScalar(1 + Math.sin(state.elapsed * 7) * 0.12);
    if (ball.position.y < BALL_R || ball.position.z < player.position.z - 2.5) resolveKick('miss');
  } else if (state.phase === 'headed') {
    if (ball.position.z <= GOAL_Z + BALL_R) {
      const bx = ball.position.x, by = ball.position.y;
      const inGoal = Math.abs(bx) < GOAL_HALF_W - 0.15 && by < GOAL_H - 0.1;
      if (inGoal && keeperSaves(bx, by)) {
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
    } else if (ball.position.z < GOAL_Z - 3) {
      resolveKick('out');
    }
  } else if (state.phase === 'result') {
    state.resultT += dt;
    if (ball.position.z < GOAL_Z - 1.4) { ball.position.z = GOAL_Z - 1.4; state.ballVel.z = 0; }
    if (state.resultT > 1.4) {
      if (state.kicks >= KICKS_PER_ROUND) endRound();
      else newBall();
    }
  } else if (state.phase === 'swap') {
    state.resultT += dt;
    if (state.resultT > 1.6) newBall();
  }

  updateKeeper(dt);

  if (state.netPulse > 0) {
    state.netPulse = Math.max(0, state.netPulse - dt * 2);
    const s = 1 + Math.sin(state.netPulse * Math.PI) * 0.06;
    netBack.scale.set(s, s, 1);
  }
}

ball.position.set(0, BALL_R, 2);
landRing.visible = false;
setScore();
app.start(update);

// debugging / test hook: step(dt) advances one frame, render() draws it
window.__pendel = {
  app, state, keeper, keeperG, ball, player, reticle,
  startGame, tryHeader, keeperSaves,
  step: (dt) => app.step(dt),
  render: () => app.frame(0),
};
