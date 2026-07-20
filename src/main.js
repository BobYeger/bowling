import * as THREE from 'three';

// ---------- Marker palette (sampled from the drawings) ----------
const PAPER = 0xf8f5ec;
const MARKER_BLUE = 0x2b4bd7;
const MARKER_BLUE_DARK = 0x1d35a8;
const SCRIBBLE_RED_DARK = 0xb93007;
const MARKER_PURPLE = 0x8a3fd0;
const MARKER_PURPLE_DARK = 0x5f2496;
const MARKER_GREEN = 0x63a412;
const MARKER_GREEN_DARK = 0x3f7106;
const MARKER_YELLOW = 0xf2c414;
const MARKER_YELLOW_DARK = 0xc79a06;
const MARKER_ORANGE = 0xe07612;
const MARKER_ORANGE_DARK = 0xa9560a;
const SPOKE_RED = 0x9c3a24;
const SPOKE_RED_DARK = 0x6e2415;
const LINE_BROWN = 0xa08266;

// ---------- Constants ----------
const LANE_HALF = 13;
const BALL_R = 1;
const BALL_MAX_SPEED = 19;
const BALL_ACCEL = 55;
const BALL_DRAG = 2.4;
const BALL_DRAG_STOP = 7.0;    // stronger brake with no input — stopping is the panic button
const BREAK_SPEED = 14;        // faster than this, the ball rips free from a grabber's grip
const GRAB_RADIUS = 1.05;      // grabber tip touching distance
const STRIKE_DIST = 2.6;
const RACKS_AHEAD = 3;
const MAX_MONSTERS = 14;
const SHOT_SPEED = 30;
const SHOT_COOLDOWN = 0.3;
const AMMO_START = 6;
const AMMO_MAX = 9;
const AMMO_PER_STRIKE = 3;
const Z_AXIS = new THREE.Vector3(0, 0, 1);

// ---------- Renderer / scene ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.getElementById('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(PAPER);
scene.fog = new THREE.Fog(PAPER, 40, 105);

const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 300);

scene.add(new THREE.HemisphereLight(0xffffff, 0xcfc4a8, 1.4));
const sun = new THREE.DirectionalLight(0xfff4e0, 1.2);
sun.position.set(8, 20, 14);
scene.add(sun);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------- Materials ----------
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

const shadowGeo = new THREE.CircleGeometry(1, 20);
function makeShadow(radius, y = 0.02) {
  const s = new THREE.Mesh(shadowGeo, new THREE.MeshBasicMaterial({ color: 0xd6cdb9, transparent: true, opacity: 0.6 }));
  s.rotation.x = -Math.PI / 2;
  s.scale.setScalar(radius);
  s.position.y = y;
  return s;
}

// ---------- Hand-drawn textures ----------
function makeScribbleTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#f3e3d3';
  g.fillRect(0, 0, 256, 256);
  g.lineCap = 'round';
  for (let i = 0; i < 260; i++) {
    g.strokeStyle = Math.random() < 0.5 ? '#e8481c' : '#d13a10';
    g.lineWidth = 5 + Math.random() * 8;
    const x = Math.random() * 256, y = Math.random() * 256, a = Math.random() * Math.PI;
    const len = 30 + Math.random() * 60;
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(
      x + Math.cos(a) * len / 2 + (Math.random() * 20 - 10),
      y + Math.sin(a) * len / 2 + (Math.random() * 20 - 10),
      x + Math.cos(a) * len, y + Math.sin(a) * len
    );
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function makePaperTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#f8f5ec';
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 140; i++) {
    g.fillStyle = Math.random() < 0.5 ? '#efeadd' : '#f1ece0';
    const x = Math.random() * 256, y = Math.random() * 256;
    g.beginPath();
    g.arc(x, y, 1 + Math.random() * 2.2, 0, Math.PI * 2);
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function makeZigzagTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 64;
  const g = c.getContext('2d');
  g.strokeStyle = '#1c1c1c';
  g.lineWidth = 7;
  g.lineJoin = 'round';
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(12, 44);
  for (let i = 1; i <= 5; i++) g.lineTo(12 + i * 21, i % 2 ? 18 : 44);
  g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function makeSpiralTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#f8f5ec';
  g.fillRect(0, 0, 256, 256);
  g.strokeStyle = '#e07612';
  g.lineWidth = 11;
  g.lineCap = 'round';
  g.beginPath();
  for (let a = 0; a <= Math.PI * 5.5; a += 0.05) {
    const r = 6 + a * 6.5;
    const x = 128 + Math.cos(a) * r, y = 128 + Math.sin(a) * r;
    if (a === 0) g.moveTo(x, y); else g.lineTo(x, y);
  }
  g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const scribbleTex = makeScribbleTexture();
const paperTex = makePaperTexture();
const zigzagTex = makeZigzagTexture();
const spiralTex = makeSpiralTexture();

// ---------- The paper "lane" ----------
paperTex.repeat.set(10, 40);
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(90, 340),
  new THREE.MeshBasicMaterial({ map: paperTex })
);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

const laneLines = [];
const lineGeo = new THREE.BoxGeometry(0.24, 0.02, 340);
[-1, 1].forEach((side) => {
  [0.4, 1.4].forEach((off, i) => {
    const line = new THREE.Mesh(lineGeo, flat(LINE_BROWN));
    line.position.set(side * (LANE_HALF + off), 0.01, 0);
    line.rotation.y = side * (i ? -0.004 : 0.006);
    scene.add(line);
    laneLines.push(line);
  });
});

// ---------- Ball ----------
const ball = new THREE.Group();
const ballMesh = new THREE.Mesh(
  new THREE.SphereGeometry(BALL_R, 32, 24),
  new THREE.MeshToonMaterial({ map: scribbleTex, gradientMap })
);
outline(ballMesh, SCRIBBLE_RED_DARK, 1.05);
const holeMat = flat(0x141414);
const holeGeo = new THREE.SphereGeometry(0.17, 12, 8);
[[-0.28, 0.16], [0.28, 0.16], [0, -0.26]].forEach(([hx, hy]) => {
  const hole = new THREE.Mesh(holeGeo, holeMat);
  const dir = new THREE.Vector3(hx, hy, 0.9).normalize();
  hole.position.copy(dir.multiplyScalar(BALL_R * 0.95));
  ballMesh.add(hole);
});
ball.add(ballMesh);
ball.add(makeShadow(0.95, -BALL_R + 0.03));
ball.position.y = BALL_R;
scene.add(ball);

// ---------- Pins ----------
function makePin() {
  const pin = new THREE.Group();
  const white = () => toon(0xffffff);

  const body = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.15, 0.55), white());
  body.position.y = 0.58;
  outline(body, MARKER_BLUE, 1.09);
  pin.add(body);

  const band = new THREE.Mesh(
    new THREE.BoxGeometry(1.04, 0.4, 0.59),
    new THREE.MeshToonMaterial({ map: scribbleTex, gradientMap })
  );
  band.position.y = 0.5;
  pin.add(band);

  const neck = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.5, 0.32), white());
  neck.position.y = 1.4;
  outline(neck, MARKER_BLUE, 1.16);
  pin.add(neck);

  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), white());
  knob.position.y = 1.72;
  outline(knob, MARKER_BLUE, 1.14);
  pin.add(knob);

  return pin;
}

// ---------- Eyes ----------
function makeEye(size, outlineColor) {
  const eye = new THREE.Group();
  const white = new THREE.Mesh(new THREE.SphereGeometry(size, 12, 10), flat(0xffffff));
  outline(white, outlineColor, 1.12);
  eye.add(white);
  const pupil = new THREE.Mesh(new THREE.SphereGeometry(size * 0.42, 10, 8), flat(0x141414));
  pupil.position.z = size * 0.72;
  eye.add(pupil);
  return eye;
}

// ---------- Grabbers: long bendy appendages made of sphere chains ----------
// Each monster grabs with a different body part — arms, a tongue, a tail,
// a stretching spoke, an uncoiling spiral, or a whole snake head.
function makeGrabber(m, opts) {
  const group = new THREE.Group();
  group.position.set(...opts.anchor);
  m.add(group);

  const mat = toon(opts.color);
  const balls = [];
  const n = opts.segments;
  for (let i = 0; i < n; i++) {
    const r = THREE.MathUtils.lerp(opts.baseR, opts.tipR, i / (n - 1));
    const s = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), mat);
    outline(s, opts.dark, 1.16);
    group.add(s);
    balls.push(s);
    if (opts.spikeEvery && i % opts.spikeEvery === 1) {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(r * 0.55, r * 1.7, 6), toon(opts.spikeColor));
      spike.position.y = r * 1.1;
      s.add(spike);
    }
  }
  const tip = opts.buildTip ? opts.buildTip() : null;
  if (tip) group.add(tip);

  const grabber = {
    group, balls, tip,
    cur: new THREE.Vector3(0, 0.4, 0.8),
    reach: opts.reach,
    closeSpeed: opts.closeSpeed,
    wiggle: opts.wiggle ?? 1,
    rest: opts.rest,
    phase: Math.random() * 10,
    cooldown: 0,
    aim: new THREE.Vector3(),   // heavily smoothed world-space aim point — slow to turn, easy to read
    aimInit: false,
    tipWorld: new THREE.Vector3(),
  };
  (m.userData.grabbers ??= []).push(grabber);
  return grabber;
}

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _p = new THREE.Vector3(), _mid = new THREE.Vector3();
function layoutGrabber(gr) {
  const end = gr.cur;
  _mid.copy(end).multiplyScalar(0.5);
  _mid.y += 0.45 + Math.sin(gr.phase * 1.7) * 0.4 * gr.wiggle;
  _mid.x += Math.sin(gr.phase) * 0.5 * gr.wiggle;
  const n = gr.balls.length;
  for (let i = 0; i < n; i++) {
    const t = (i + 1) / n;
    _a.copy(_mid).multiplyScalar(t);                 // lerp(origin, mid, t)
    _b.lerpVectors(_mid, end, t);
    _p.lerpVectors(_a, _b, t);
    gr.balls[i].position.copy(_p);
  }
  if (gr.tip) {
    gr.tip.position.copy(end);
    _a.copy(end).sub(gr.balls[n - 2].position).normalize();
    gr.tip.quaternion.setFromUnitVectors(Z_AXIS, _a);
  }
}

// the grabbers reach for the ball slowly and smoothly — no lunges, no tricks.
// their aim turns sluggishly and the tip crawls, so you can always see where
// they're heading and simply roll away. getting caught means you got cornered.
function updateGrabbers(m, dist, sdt, aimWorld, cinematic = false) {
  for (const gr of m.userData.grabbers) {
    gr.phase += sdt * 6;
    gr.cooldown = Math.max(0, gr.cooldown - sdt);
    let desired, moveSpeed = gr.closeSpeed;

    if (cinematic) {
      desired = gr.group.worldToLocal(aimWorld.clone());
      moveSpeed = 10;
    } else if (dist < 10 && gr.cooldown === 0) {
      if (!gr.aimInit) {
        gr.group.getWorldPosition(gr.aim);
        gr.aimInit = true;
      }
      gr.aim.lerp(aimWorld, 1 - Math.exp(-1.5 * sdt)); // the aim itself drifts slowly
      desired = gr.group.worldToLocal(gr.aim.clone());
      if (desired.length() > gr.reach) desired.setLength(gr.reach);
    } else {
      desired = gr.rest(gr.phase);
    }

    desired.y = Math.max(desired.y, -gr.group.position.y + 0.25); // don't dig into the paper
    const step = moveSpeed * sdt;
    _p.copy(desired).sub(gr.cur);
    if (_p.length() <= step) gr.cur.copy(desired);
    else gr.cur.addScaledVector(_p.normalize(), step);
    layoutGrabber(gr);
    gr.tipWorld.copy(gr.cur).applyMatrix4(gr.group.matrixWorld);
  }
}

// ---------- Monsters (drawing #1) ----------
function makePurpleMonster() {
  const m = new THREE.Group();

  const loop = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.26, 12, 24), toon(MARKER_PURPLE));
  loop.scale.y = 2.0;
  loop.position.y = 2.35;
  outline(loop, MARKER_PURPLE_DARK, 1.09);
  m.add(loop);

  const stroke = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 1.5, 4, 10), toon(MARKER_PURPLE));
  stroke.position.y = 2.35;
  m.add(stroke);

  const wheels = [];
  [-1, 1].forEach((side) => {
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.12, 10, 16), toon(MARKER_PURPLE));
    wheel.position.set(side * 0.85, 0.42, 0);
    outline(wheel, MARKER_PURPLE_DARK, 1.1);
    m.add(wheel);
    wheels.push(wheel);
  });

  // two long swaying arms ending in little rings
  [-1, 1].forEach((side) => {
    makeGrabber(m, {
      anchor: [side * 0.95, 2.6, 0.1],
      color: MARKER_PURPLE, dark: MARKER_PURPLE_DARK,
      segments: 8, baseR: 0.16, tipR: 0.11,
      reach: 4.5, closeSpeed: 4.5,
      rest: (t) => new THREE.Vector3(side * (0.9 + Math.sin(t * 0.9) * 0.35), -1.3 + Math.sin(t * 1.3) * 0.5, 0.5),
      buildTip: () => {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.09, 8, 14), toon(MARKER_PURPLE));
        outline(ring, MARKER_PURPLE_DARK, 1.15);
        return ring;
      },
    });
  });

  m.userData.wheels = wheels;
  m.userData.kind = 'purple';
  m.userData.holdHeight = 3.6;
  return m;
}

function makeGreenMonster() {
  const m = new THREE.Group();

  const body = new THREE.Mesh(new THREE.SphereGeometry(0.72, 16, 12), toon(MARKER_GREEN));
  body.scale.y = 0.9;
  body.position.y = 1.05;
  outline(body, MARKER_GREEN_DARK, 1.08);
  m.add(body);

  const zig = new THREE.Mesh(
    new THREE.PlaneGeometry(0.95, 0.47),
    new THREE.MeshBasicMaterial({ map: zigzagTex, transparent: true })
  );
  zig.position.set(0, 1.25, 0.68);
  m.add(zig);

  const skirt = new THREE.Mesh(new THREE.ConeGeometry(0.6, 0.9, 4), toon(MARKER_GREEN));
  skirt.rotation.x = Math.PI;
  skirt.rotation.y = Math.PI / 4;
  skirt.position.y = 0.42;
  outline(skirt, MARKER_GREEN_DARK, 1.1);
  m.add(skirt);

  [-0.32, 0.32].forEach((x) => {
    const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.95, 8), toon(MARKER_GREEN));
    stalk.position.set(x, 2.0, 0);
    stalk.rotation.z = -x * 0.5;
    m.add(stalk);
    const eye = makeEye(0.27, MARKER_GREEN_DARK);
    eye.position.set(x * 1.75, 2.5, 0);
    m.add(eye);
  });

  // a long sticky tongue shoots out from under the zigzag mouth
  makeGrabber(m, {
    anchor: [0, 0.95, 0.6],
    color: MARKER_GREEN_DARK, dark: 0x2a4c04,
    segments: 9, baseR: 0.13, tipR: 0.1,
    reach: 5, closeSpeed: 4.8, wiggle: 1.3,
    rest: (t) => new THREE.Vector3(Math.sin(t * 0.8) * 0.5, -0.3 + Math.sin(t * 1.4) * 0.25, 0.7),
    buildTip: () => {
      const paw = new THREE.Group();
      const blob = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), toon(MARKER_GREEN_DARK));
      outline(blob, 0x2a4c04, 1.15);
      paw.add(blob);
      for (let i = 0; i < 3; i++) {
        const f = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), toon(MARKER_GREEN_DARK));
        const a = (i / 3) * Math.PI * 2;
        f.position.set(Math.cos(a) * 0.16, Math.sin(a) * 0.16, 0.14);
        paw.add(f);
      }
      return paw;
    },
  });

  m.userData.kind = 'green';
  m.userData.holdHeight = 2.5;
  return m;
}

function makeYellowWheel() {
  const m = new THREE.Group();
  const spinner = new THREE.Group();

  const rim = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.2, 12, 24), toon(MARKER_YELLOW));
  outline(rim, MARKER_YELLOW_DARK, 1.08);
  spinner.add(rim);

  for (let i = 0; i < 4; i++) {
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.13, 2.1, 0.13), toon(SPOKE_RED));
    spoke.rotation.z = (i * Math.PI) / 4;
    spinner.add(spoke);
  }

  spinner.position.y = 1.35;
  m.add(spinner);

  // a fifth spoke stretches right out of the hub to snatch the ball
  makeGrabber(m, {
    anchor: [0, 1.35, 0.25],
    color: SPOKE_RED, dark: SPOKE_RED_DARK,
    segments: 9, baseR: 0.12, tipR: 0.09,
    reach: 5.2, closeSpeed: 4.8,
    rest: (t) => new THREE.Vector3(Math.cos(t * 0.9) * 1.5, Math.sin(t * 0.9) * 1.5, 0.15),
    buildTip: () => {
      const claw = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.07, 8, 12, Math.PI * 1.4), toon(MARKER_YELLOW));
      outline(claw, MARKER_YELLOW_DARK, 1.15);
      return claw;
    },
  });

  m.userData.spinner = spinner;
  m.userData.kind = 'wheel';
  m.userData.holdHeight = 2.8;
  return m;
}

// ---------- Monsters (drawing #2) ----------
function makeSnake() {
  const m = new THREE.Group();

  // little tail stub at the root — the rest of the body IS the grabber
  const stub = new THREE.Mesh(new THREE.SphereGeometry(0.38, 12, 10), toon(MARKER_GREEN));
  stub.position.y = 0.4;
  outline(stub, MARKER_GREEN_DARK, 1.1);
  m.add(stub);

  makeGrabber(m, {
    anchor: [0, 0.4, 0],
    color: MARKER_GREEN, dark: MARKER_GREEN_DARK,
    segments: 13, baseR: 0.34, tipR: 0.21,
    reach: 5.5, closeSpeed: 4.5, wiggle: 1.4,
    spikeEvery: 2, spikeColor: MARKER_PURPLE,
    rest: (t) => new THREE.Vector3(Math.sin(t * 0.7) * 0.9, 2.1 + Math.sin(t * 1.1) * 0.5, 1.1),
    buildTip: () => {
      const head = new THREE.Group();
      const skull = new THREE.Mesh(new THREE.SphereGeometry(0.42, 14, 12), toon(MARKER_BLUE));
      outline(skull, MARKER_BLUE_DARK, 1.1);
      head.add(skull);
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.45, 6), toon(MARKER_PURPLE));
      horn.position.set(0, 0.45, 0);
      head.add(horn);
      const e1 = makeEye(0.14, MARKER_BLUE_DARK); e1.position.set(-0.18, 0.15, 0.36); head.add(e1);
      const e2 = makeEye(0.14, MARKER_BLUE_DARK); e2.position.set(0.18, 0.15, 0.36); head.add(e2);
      return head;
    },
  });

  m.userData.kind = 'snake';
  m.userData.holdHeight = 3.2;
  return m;
}

function makeDino() {
  const m = new THREE.Group();

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.55, 1.3, 6, 12), toon(MARKER_GREEN));
  body.rotation.x = Math.PI / 2;
  body.position.y = 0.85;
  outline(body, MARKER_GREEN_DARK, 1.08);
  m.add(body);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.4, 14, 12), toon(MARKER_GREEN));
  head.position.set(0, 1.25, 1.05);
  outline(head, MARKER_GREEN_DARK, 1.1);
  m.add(head);
  const snout = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.3, 4, 8), toon(MARKER_GREEN));
  snout.rotation.x = Math.PI / 2;
  snout.position.set(0, 1.15, 1.45);
  m.add(snout);
  const e1 = makeEye(0.13, MARKER_GREEN_DARK); e1.position.set(-0.18, 1.45, 1.3); m.add(e1);
  const e2 = makeEye(0.13, MARKER_GREEN_DARK); e2.position.set(0.18, 1.45, 1.3); m.add(e2);

  // orange triangle legs all along the body, like the drawing
  const legs = [];
  [-0.32, 0.32].forEach((x) => {
    for (let i = 0; i < 3; i++) {
      const leg = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.6, 5), toon(MARKER_ORANGE));
      leg.rotation.x = Math.PI; // triangle points down
      leg.position.set(x, 0.32, 0.55 - i * 0.55);
      outline(leg, MARKER_ORANGE_DARK, 1.12);
      m.add(leg);
      legs.push(leg);
    }
  });
  // little orange ears on the head too
  [-0.14, 0.14].forEach((x) => {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.3, 5), toon(MARKER_ORANGE));
    ear.position.set(x, 1.72, 0.95);
    m.add(ear);
  });
  m.userData.legs = legs;

  // the spiky tail whips right over its head, scorpion-style
  makeGrabber(m, {
    anchor: [0, 1.1, -0.85],
    color: MARKER_GREEN, dark: MARKER_GREEN_DARK,
    segments: 10, baseR: 0.22, tipR: 0.12,
    reach: 5, closeSpeed: 4.5, wiggle: 1.2,
    spikeEvery: 3, spikeColor: MARKER_ORANGE,
    rest: (t) => new THREE.Vector3(Math.sin(t) * 0.6, 1.5 + Math.sin(t * 1.3) * 0.45, -1.5),
    buildTip: () => {
      const spike = new THREE.Group();
      const c1 = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.5, 6), toon(MARKER_ORANGE));
      c1.rotation.x = Math.PI / 2;
      c1.position.z = 0.2;
      outline(c1, MARKER_ORANGE_DARK, 1.15);
      spike.add(c1);
      const c2 = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.35, 6), toon(MARKER_ORANGE));
      c2.rotation.z = Math.PI / 2.5;
      c2.position.set(-0.15, 0.1, 0);
      spike.add(c2);
      return spike;
    },
  });

  m.userData.kind = 'dino';
  m.userData.holdHeight = 3.0;
  return m;
}

function makeSnail() {
  const m = new THREE.Group();

  // spiral shell disc, face-on like the drawing
  const disc = new THREE.Mesh(
    new THREE.CylinderGeometry(1.05, 1.05, 0.3, 24),
    [toon(MARKER_ORANGE), new THREE.MeshToonMaterial({ map: spiralTex, gradientMap }), new THREE.MeshToonMaterial({ map: spiralTex, gradientMap })]
  );
  disc.rotation.x = Math.PI / 2;
  disc.position.y = 1.15;
  outline(disc, MARKER_ORANGE_DARK, 1.07);
  m.add(disc);

  // spiky crown on top
  for (let i = -1; i <= 1; i++) {
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.55, 6), toon(MARKER_ORANGE));
    spike.position.set(i * 0.42, 2.35 - Math.abs(i) * 0.15, 0);
    spike.rotation.z = -i * 0.35;
    outline(spike, MARKER_ORANGE_DARK, 1.12);
    m.add(spike);
  }

  // the spiral itself uncoils into a long grabby arm
  makeGrabber(m, {
    anchor: [0.55, 1.15, 0.25],
    color: MARKER_ORANGE, dark: MARKER_ORANGE_DARK,
    segments: 10, baseR: 0.16, tipR: 0.1,
    reach: 5, closeSpeed: 4.8, wiggle: 1.1,
    rest: (t) => new THREE.Vector3(Math.cos(t * 0.8) * 0.9, Math.sin(t * 0.8) * 0.9 + 0.2, 0.3),
    buildTip: () => {
      const end = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), toon(MARKER_ORANGE));
      end.scale.z = 0.55;
      outline(end, MARKER_ORANGE_DARK, 1.15);
      return end;
    },
  });

  m.userData.kind = 'snail';
  m.userData.holdHeight = 2.9;
  return m;
}

// ---------- The Scribble Monster (from Claude's imagination): a living tangle of marker doodles ----------
function makeScribbleMonster() {
  const m = new THREE.Group();

  const tangle = new THREE.Group();
  const ringColors = [
    [MARKER_BLUE, MARKER_BLUE_DARK],
    [MARKER_PURPLE, MARKER_PURPLE_DARK],
    [MARKER_ORANGE, MARKER_ORANGE_DARK],
    [MARKER_GREEN, MARKER_GREEN_DARK],
    [MARKER_BLUE, MARKER_BLUE_DARK],
  ];
  ringColors.forEach(([col, dark], i) => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.55 + (i % 3) * 0.14, 0.09, 8, 20), toon(col));
    ring.rotation.set(i * 1.1, i * 0.8, i * 1.7);
    outline(ring, dark, 1.14);
    tangle.add(ring);
  });
  tangle.position.y = 1.25;
  m.add(tangle);

  const e1 = makeEye(0.24, MARKER_BLUE_DARK); e1.position.set(-0.3, 1.9, 0.5); m.add(e1);
  const e2 = makeEye(0.3, MARKER_BLUE_DARK); e2.position.set(0.32, 2.0, 0.5); m.add(e2); // googly, mismatched

  // a doodle-tendril unspools from the tangle to scribble you into its clutches
  makeGrabber(m, {
    anchor: [0, 1.25, 0.4],
    color: MARKER_BLUE, dark: MARKER_BLUE_DARK,
    segments: 10, baseR: 0.14, tipR: 0.1,
    reach: 5, closeSpeed: 4.8, wiggle: 1.6,
    rest: (t) => new THREE.Vector3(Math.sin(t * 1.3) * 1.1, 0.4 + Math.cos(t * 0.9) * 0.7, 0.6),
    buildTip: () => {
      const knot = new THREE.Group();
      [0, 1].forEach((i) => {
        const mini = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.06, 6, 12), toon(i ? MARKER_PURPLE : MARKER_BLUE));
        mini.rotation.set(i * 1.3, 0.6, i * 0.9);
        outline(mini, i ? MARKER_PURPLE_DARK : MARKER_BLUE_DARK, 1.15);
        knot.add(mini);
      });
      return knot;
    },
  });

  m.userData.tangle = tangle;
  m.userData.kind = 'scribble';
  m.userData.holdHeight = 3.1;
  return m;
}

const MONSTER_MAKERS = [makePurpleMonster, makeGreenMonster, makeYellowWheel, makeSnake, makeDino, makeSnail, makeScribbleMonster];

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
function strikeSound() {
  if (!audioCtx) return;
  [523, 659, 784, 1047].forEach((f, i) => beep(f, i * 0.08, 0.25));
}
function grabSound() {
  if (!audioCtx) return;
  beep(340, 0, 0.1, 'square', 0.15);
  beep(190, 0.09, 0.22, 'square', 0.15);
}
function knockSound() {
  if (!audioCtx) return;
  beep(140, 0, 0.09, 'square', 0.16);
  beep(500, 0.06, 0.16, 'triangle', 0.14);
  beep(750, 0.14, 0.2, 'triangle', 0.1);
}
function ripSound() {
  if (!audioCtx) return;
  beep(320, 0, 0.08, 'sawtooth', 0.12);
  beep(520, 0.06, 0.12, 'sawtooth', 0.1);
}
function shootSound() {
  if (!audioCtx) return;
  beep(880, 0, 0.07, 'square', 0.1);
  beep(440, 0.05, 0.1, 'square', 0.08);
}
function emptySound() {
  if (!audioCtx) return;
  beep(180, 0, 0.06, 'square', 0.08);
}
function gameOverSound() {
  if (!audioCtx) return;
  [400, 300, 220, 150].forEach((f, i) => beep(f, i * 0.18, 0.3, 'sawtooth'));
}

// ---------- Game state ----------
const keys = new Set();
const state = {
  running: false,
  score: 0,
  vel: new THREE.Vector3(),
  monsters: [],
  racks: [],
  flyingPins: [],
  flyingMonsters: [],
  shots: [],
  ammo: AMMO_START,
  shotCooldown: 0,
  lastAim: new THREE.Vector3(0, 0, -1),
  spawnTimer: 3,
  nextRackZ: -40,
};
let catching = null;

const scoreEl = document.getElementById('score');
const ammoEl = document.getElementById('ammo');
const strikeEl = document.getElementById('strike');
const introEl = document.getElementById('intro');
const gameoverEl = document.getElementById('gameover');
const finalScoreEl = document.getElementById('finalScore');

function setScore(s) {
  state.score = s;
  scoreEl.textContent = `נקודות: ${s}`;
}

function setAmmo(n) {
  state.ammo = THREE.MathUtils.clamp(n, 0, AMMO_MAX);
  ammoEl.textContent = `🔴 ${state.ammo}`;
}

// ---------- Racks ----------
function spawnRack(z) {
  const group = new THREE.Group();
  const center = new THREE.Vector3((Math.random() * 2 - 1) * (LANE_HALF - 4), 0, z);
  const layout = [
    [0, 0], [-0.9, -1.6], [0.9, -1.6],
    [-1.8, -3.2], [0, -3.2], [1.8, -3.2],
  ];
  const pins = layout.map(([x, dz]) => {
    const p = makePin();
    p.position.set(center.x + x, 0, center.z + dz);
    p.rotation.y = (Math.random() - 0.5) * 0.3;
    group.add(p);
    return p;
  });
  scene.add(group);
  state.racks.push({ center, pins, group });
}

function ensureRacks() {
  while (state.racks.length < RACKS_AHEAD) {
    spawnRack(state.nextRackZ);
    state.nextRackZ -= 45 + Math.random() * 45;
  }
}

function doStrike(rack) {
  setScore(state.score + 10);
  setAmmo(state.ammo + AMMO_PER_STRIKE);
  strikeSound();
  strikeEl.classList.add('show');
  setTimeout(() => strikeEl.classList.remove('show'), 900);

  for (const pin of rack.pins) {
    const dir = pin.position.clone().sub(ball.position);
    dir.y = 0;
    dir.normalize();
    state.flyingPins.push({
      mesh: pin,
      vel: new THREE.Vector3(
        dir.x * (6 + Math.random() * 5),
        9 + Math.random() * 6,
        dir.z * (6 + Math.random() * 5)
      ),
      spin: new THREE.Vector3(Math.random() * 8 - 4, Math.random() * 8 - 4, Math.random() * 8 - 4),
      life: 2.5,
    });
    scene.attach(pin);
  }
  scene.remove(rack.group);
  state.racks.splice(state.racks.indexOf(rack), 1);
}

// ---------- Monster spawning: always far away, never popping into view ----------
function spawnMonster() {
  if (state.monsters.length >= MAX_MONSTERS) return;
  const make = MONSTER_MAKERS[Math.floor(Math.random() * MONSTER_MAKERS.length)];
  const m = make();
  const x = (Math.random() * 2 - 1) * LANE_HALF;
  if (Math.random() < 0.65) {
    // most monsters wait ahead in the fog, right in your path
    m.position.set(x, 0, ball.position.z - 110 - Math.random() * 15);
  } else {
    m.position.set(x, 0, ball.position.z + 45 + Math.random() * 15);
  }
  m.add(makeShadow(1.15));
  m.userData.speed = Math.min(12, 7 + state.score * 0.035 + Math.random() * 1.2);
  m.userData.vel = new THREE.Vector3();
  m.userData.agility = 7.5 + Math.random() * 3; // steering force — how quickly it can change course
  m.userData.bob = Math.random() * Math.PI * 2;
  m.userData.grow = 0;
  scene.add(m);
  state.monsters.push(m);
}

function caught(m) {
  if (catching) return;
  state.running = false;
  grabSound();
  catching = { m, t: 0, from: ball.position.clone(), baseY: m.position.y };
}

// ---------- Reset / start ----------
function resetGame() {
  for (const m of state.monsters) scene.remove(m);
  for (const r of state.racks) scene.remove(r.group);
  for (const fp of state.flyingPins) scene.remove(fp.mesh);
  for (const fm of state.flyingMonsters) scene.remove(fm.mesh);
  for (const s of state.shots) scene.remove(s.mesh);
  state.monsters = [];
  state.racks = [];
  state.flyingPins = [];
  state.flyingMonsters = [];
  state.shots = [];
  state.vel.set(0, 0, 0);
  state.lastAim.set(0, 0, -1);
  state.shotCooldown = 0;
  state.spawnTimer = 2.5;
  state.nextRackZ = -35;
  catching = null;
  ball.position.set(0, BALL_R, 0);
  ballMesh.rotation.set(0, 0, 0);
  setScore(0);
  setAmmo(AMMO_START);
  ensureRacks();
  spawnMonster();
  spawnMonster();
  spawnMonster();
  camera.position.set(0, 8, 12);
  camera.lookAt(0, 0, -5);
}

function startGame() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  resetGame();
  introEl.classList.add('hidden');
  gameoverEl.classList.add('hidden');
  state.running = true;
}

function showGameOver() {
  gameOverSound();
  finalScoreEl.textContent = `הבאתם ${state.score} נקודות! 🎳`;
  gameoverEl.classList.remove('hidden');
}

document.getElementById('startBtn').addEventListener('click', startGame);
document.getElementById('restartBtn').addEventListener('click', startGame);

window.addEventListener('keydown', (e) => {
  keys.add(e.code);
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  // Enter or Space starts the game from the intro or the game-over screen
  if (!state.running && (e.code === 'Enter' || e.code === 'Space')) {
    if (!introEl.classList.contains('hidden') || !gameoverEl.classList.contains('hidden')) startGame();
  }
});
window.addEventListener('keyup', (e) => keys.delete(e.code));

// ---------- Main loop ----------
const clock = new THREE.Clock();
const camTarget = new THREE.Vector3();

function tick() {
  requestAnimationFrame(tick);
  update(Math.min(clock.getDelta(), 0.05));
  renderer.render(scene, camera);
}

function update(dt) {
  if (state.running) {
    // --- ball input ---
    const input = new THREE.Vector3(
      (keys.has('ArrowRight') || keys.has('KeyD') ? 1 : 0) - (keys.has('ArrowLeft') || keys.has('KeyA') ? 1 : 0),
      0,
      (keys.has('ArrowDown') || keys.has('KeyS') ? 1 : 0) - (keys.has('ArrowUp') || keys.has('KeyW') ? 1 : 0)
    );
    if (input.lengthSq() > 0) input.normalize();

    state.vel.addScaledVector(input, BALL_ACCEL * dt);
    state.vel.addScaledVector(state.vel, -(input.lengthSq() > 0 ? BALL_DRAG : BALL_DRAG_STOP) * dt);
    if (state.vel.length() > BALL_MAX_SPEED) state.vel.setLength(BALL_MAX_SPEED);
    if (input.lengthSq() === 0 && state.vel.length() < 0.7) state.vel.set(0, 0, 0);

    ball.position.addScaledVector(state.vel, dt);
    ball.position.x = THREE.MathUtils.clamp(ball.position.x, -LANE_HALF + BALL_R, LANE_HALF - BALL_R);

    const speed = state.vel.length();
    if (speed > 0.01) {
      const axis = new THREE.Vector3(0, 1, 0).cross(state.vel).normalize();
      ballMesh.rotateOnWorldAxis(axis, (speed * dt) / BALL_R);
    }
    if (speed > 0.5) state.lastAim.copy(state.vel).normalize();

    // === THE RULE: the world only moves when the ball moves ===
    // dead zone + curve: near-stopped means truly frozen, slow rolling barely moves the world
    const worldScale = Math.pow(
      THREE.MathUtils.clamp((speed - 1.0) / (BALL_MAX_SPEED * 0.55 - 1.0), 0, 1),
      1.35
    );
    const sdt = dt * worldScale;

    // --- monsters chase; their grabby parts do the catching ---
    for (const m of state.monsters) {
      const ud = m.userData;
      const dir = ball.position.clone().sub(m.position);
      dir.y = 0;
      const dist = dir.length();
      dir.normalize();

      // close in, but slow down while the grabber is reaching — the arm does the work
      const moveSpeed = dist < 2.8 ? ud.speed * 0.35 : dist < 8 ? ud.speed * 0.55 : ud.speed;
      // momentum: steer the velocity toward the ball with limited force, so a
      // dodge makes the monster carry past and swing around in an arc
      _p.copy(dir).multiplyScalar(moveSpeed).sub(ud.vel);
      const steerStep = ud.agility * sdt;
      if (_p.length() > steerStep) _p.setLength(steerStep);
      ud.vel.add(_p);
      m.position.addScaledVector(ud.vel, sdt);
      if (ud.kind === 'snake' || ud.kind === 'snail') {
        m.position.x += dir.z * Math.sin(ud.bob * 1.7) * 2.0 * sdt;  // slither
        m.position.z += -dir.x * Math.sin(ud.bob * 1.7) * 2.0 * sdt;
      }
      // face where it's going (or the ball when nearly still), turning gradually
      const facing = ud.vel.lengthSq() > 0.5 ? ud.vel : dir;
      const targetYaw = Math.atan2(facing.x, facing.z);
      let dYaw = targetYaw - m.rotation.y;
      dYaw = ((dYaw % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2) - Math.PI;
      m.rotation.y += THREE.MathUtils.clamp(dYaw, -1.8 * sdt, 1.8 * sdt);

      ud.grow = Math.min(1, ud.grow + sdt * 2.2);
      m.scale.setScalar(0.05 + 0.95 * ud.grow);

      ud.bob += sdt * 8;
      if (ud.kind === 'green') m.position.y = Math.abs(Math.sin(ud.bob)) * 0.4;
      if (ud.kind === 'purple') for (const w of ud.wheels) w.rotation.z -= ud.speed * sdt;
      if (ud.kind === 'wheel') ud.spinner.rotation.z -= ud.speed * sdt * 0.9;
      if (ud.kind === 'dino') ud.legs.forEach((l, i) => { l.rotation.z = Math.sin(ud.bob * 1.6 + i * 2.1) * 0.35; });
      if (ud.kind === 'scribble') { ud.tangle.rotation.y += sdt * 1.6; ud.tangle.rotation.x += sdt * 0.9; }

      m.updateMatrixWorld();
      updateGrabbers(m, dist, sdt, ball.position);

      // a grabber tip touching the ball: slow ball is caught, fast ball rips free
      const tipTouch = ud.grabbers.some((gr) => gr.cooldown === 0 && gr.tipWorld.distanceTo(ball.position) < GRAB_RADIUS);
      if (tipTouch && speed < BREAK_SPEED) {
        caught(m);
        break;
      }
      if (tipTouch) {
        for (const gr of ud.grabbers) gr.cooldown = 1.2;
        ripSound();
      }
      // bumping into a monster's body catches you — no exceptions, so don't touch them!
      if (dist < 1.6) {
        caught(m);
        break;
      }
    }

    // --- shooting: space fires a mini scribble-ball at the monsters ---
    state.shotCooldown -= dt;
    if (keys.has('Space') && state.shotCooldown <= 0 && state.running) {
      state.shotCooldown = SHOT_COOLDOWN;
      if (state.ammo <= 0) {
        emptySound();
      } else {
        setAmmo(state.ammo - 1);
        // aim where we're rolling, with a friendly nudge toward a nearby monster
        const aim = state.lastAim.clone();
        let best = null, bestAngle = 0.6;
        for (const m of state.monsters) {
          const to = m.position.clone().sub(ball.position);
          to.y = 0;
          if (to.length() > 30) continue;
          const angle = aim.angleTo(to.normalize());
          if (angle < bestAngle) { bestAngle = angle; best = to; }
        }
        if (best) aim.copy(best);
        const shot = new THREE.Mesh(
          new THREE.SphereGeometry(0.32, 12, 10),
          new THREE.MeshToonMaterial({ map: scribbleTex, gradientMap })
        );
        outline(shot, SCRIBBLE_RED_DARK, 1.1);
        shot.position.copy(ball.position).addScaledVector(aim, 1.4);
        scene.add(shot);
        state.shots.push({ mesh: shot, vel: aim.clone().multiplyScalar(SHOT_SPEED), life: 1.3 });
        shootSound();
      }
    }

    // shots obey THE RULE too — they only fly while the ball moves.
    // stand frozen, fire a volley into the air, then roll: they all launch at once!
    state.shots = state.shots.filter((s) => {
      s.mesh.position.addScaledVector(s.vel, sdt);
      s.mesh.rotation.x += sdt * 12;
      s.life -= sdt;
      let spent = s.life <= 0;
      for (const m of state.monsters) {
        const dx = m.position.x - s.mesh.position.x;
        const dz = m.position.z - s.mesh.position.z;
        if (dx * dx + dz * dz < 1.7 * 1.7) {
          m.userData.knocked = true;
          m.userData.knockDir = s.vel.clone().normalize();
          spent = true;
          break;
        }
      }
      if (!spent) {
        for (const rack of [...state.racks]) {
          const hit = rack.pins.some((p) => {
            const dx = p.position.x - s.mesh.position.x;
            const dz = p.position.z - s.mesh.position.z;
            return dx * dx + dz * dz < 1.2 * 1.2;
          });
          if (hit) { doStrike(rack); spent = true; break; } // sniping a rack counts — always a strike!
        }
      }
      if (spent) scene.remove(s.mesh);
      return !spent;
    });

    // monsters hit by a shot fly off like pins
    for (const m of state.monsters) {
      if (!m.userData.knocked) continue;
      knockSound();
      const dir = m.userData.knockDir;
      state.flyingMonsters.push({
        mesh: m,
        vel: new THREE.Vector3(dir.x * 11, 10 + Math.random() * 4, dir.z * 11),
        spin: new THREE.Vector3(Math.random() * 10 - 5, Math.random() * 6 - 3, Math.random() * 10 - 5),
        life: 1.7,
      });
    }
    if (state.flyingMonsters.length) {
      state.monsters = state.monsters.filter((m) => !m.userData.knocked);
    }

    if (state.running) {
      state.monsters = state.monsters.filter((m) => {
        if (m.position.z - ball.position.z > 70) {
          scene.remove(m);
          return false;
        }
        return true;
      });

      state.spawnTimer -= sdt;
      if (state.spawnTimer <= 0) {
        spawnMonster();
        if (state.monsters.length < 6) spawnMonster(); // thin herd? send reinforcements
        state.spawnTimer = Math.max(1.6, 4.2 - state.score * 0.03);
      }

      // --- strikes ---
      for (const rack of [...state.racks]) {
        const hit = rack.pins.some((p) => {
          const dx = p.position.x - ball.position.x;
          const dz = p.position.z - ball.position.z;
          return dx * dx + dz * dz < STRIKE_DIST * STRIKE_DIST;
        });
        if (hit && speed > 1) doStrike(rack);
      }

      state.racks = state.racks.filter((r) => {
        if (r.center.z - ball.position.z > 30) {
          scene.remove(r.group);
          return false;
        }
        return true;
      });
      ensureRacks();

      // --- knocked monsters tumble away ---
      state.flyingMonsters = state.flyingMonsters.filter((fm) => {
        fm.vel.y -= 25 * sdt;
        fm.mesh.position.addScaledVector(fm.vel, sdt);
        fm.mesh.rotation.x += fm.spin.x * sdt;
        fm.mesh.rotation.z += fm.spin.z * sdt;
        fm.life -= sdt;
        if (fm.life < 0.4) fm.mesh.scale.multiplyScalar(Math.max(0.01, 1 - sdt * 3));
        if (fm.life <= 0 || fm.mesh.position.y < -6) {
          scene.remove(fm.mesh);
          return false;
        }
        return true;
      });

      // --- flying pins ---
      state.flyingPins = state.flyingPins.filter((fp) => {
        fp.vel.y -= 25 * sdt;
        fp.mesh.position.addScaledVector(fp.vel, sdt);
        fp.mesh.rotation.x += fp.spin.x * sdt;
        fp.mesh.rotation.y += fp.spin.y * sdt;
        fp.mesh.rotation.z += fp.spin.z * sdt;
        fp.life -= sdt;
        if (fp.life <= 0 || fp.mesh.position.y < -6) {
          scene.remove(fp.mesh);
          return false;
        }
        return true;
      });

      // scroll the paper with the ball
      ground.position.z = ball.position.z;
      paperTex.offset.y = -ball.position.z / (340 / 40);
      for (const line of laneLines) line.position.z = ball.position.z;
    }
  }

  // --- the "gotcha" cinematic: grabbers wrap the ball and hold it up ---
  if (catching) {
    catching.t += dt;
    const m = catching.m;
    m.updateMatrixWorld();
    const holdPos = m.localToWorld(new THREE.Vector3(0, m.userData.holdHeight, 0.85));
    updateGrabbers(m, 0, dt, holdPos, true);
    ball.position.lerp(holdPos, Math.min(1, catching.t / 0.45));
    m.position.y = catching.baseY + (catching.t < 1.1 ? Math.abs(Math.sin(catching.t * 7)) * 0.45 : 0);
    ballMesh.rotation.y += dt * 3;
    if (catching.t > 1.2 && !catching.shown) {
      catching.shown = true;
      showGameOver();
    }
  }

  // --- camera follows ---
  camTarget.set(ball.position.x * 0.6, 8, ball.position.z + 12);
  camera.position.lerp(camTarget, 1 - Math.exp(-4 * dt));
  camera.lookAt(ball.position.x * 0.6, 1, ball.position.z - 6);
}

resetGame();
state.running = false;
tick();

// debugging hook for tests
window.__game = { state, ball, startGame, spawnMonster, update, render: () => renderer.render(scene, camera) };
