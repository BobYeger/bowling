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
const MARKER_GREY = 0x9aa0a6;
const MARKER_GREY_DARK = 0x686e73;
const MARKER_TEAL = 0x0f8f6d;
const MARKER_TEAL_DARK = 0x0a5f49;
const ALIEN_GREEN = 0x7fae3e;
const ALIEN_GREEN_DARK = 0x567a24;

// ---------- Constants ----------
const LANE_HALF = 13;
const BALL_R = 1;
const BALL_MAX_SPEED = 19;
const BALL_ACCEL = 55;
const BALL_DRAG = 2.4;
const BALL_DRAG_STOP = 7.0;    // stronger brake with no input — stopping is the panic button
const BREAK_SPEED = 14;        // faster than this, the ball rips free from a grabber's grip
const GRAB_RADIUS = 0.95;      // grabber tip touching distance (each tip adds its own size on top)
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

// ---------- Grabbers: long bendy appendages drawn as smooth continuous tubes ----------
// Each monster grabs with a different body part — arms, a tongue, a tail,
// a stretching spoke, an uncoiling spiral, or a whole snake head.
// The tube vertices are recomputed each frame along a bezier, into fixed buffers.
const TUBE_RINGS = 14;
const TUBE_SIDES = 8;
const _pts = Array.from({ length: TUBE_RINGS }, () => new THREE.Vector3());
const _tan = new THREE.Vector3(), _bin = new THREE.Vector3(), _nrmPT = new THREE.Vector3(), _dir = new THREE.Vector3();

function makeTubeGeometry() {
  const geo = new THREE.BufferGeometry();
  const vertCount = TUBE_RINGS * TUBE_SIDES;
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertCount * 3), 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(vertCount * 3), 3));
  const idx = [];
  for (let i = 0; i < TUBE_RINGS - 1; i++) {
    for (let j = 0; j < TUBE_SIDES; j++) {
      const a = i * TUBE_SIDES + j;
      const b = i * TUBE_SIDES + ((j + 1) % TUBE_SIDES);
      const c = (i + 1) * TUBE_SIDES + j;
      const d = (i + 1) * TUBE_SIDES + ((j + 1) % TUBE_SIDES);
      idx.push(a, b, c, b, d, c); // outward-facing winding, agrees with the ring normals
    }
  }
  geo.setIndex(idx);
  return geo;
}

// write ring vertices along the sampled curve (_pts) with tapering radius
function fillTube(geo, r0, r1) {
  const pos = geo.attributes.position.array;
  const nor = geo.attributes.normal.array;
  _nrmPT.set(0, 1, 0);
  let k = 0;
  for (let i = 0; i < TUBE_RINGS; i++) {
    const p = _pts[i];
    _tan.subVectors(_pts[Math.min(TUBE_RINGS - 1, i + 1)], _pts[Math.max(0, i - 1)]);
    if (_tan.lengthSq() < 1e-10) _tan.set(0, 0, 1);
    else _tan.normalize();
    // parallel transport: keep the ring frame from twisting
    _nrmPT.addScaledVector(_tan, -_nrmPT.dot(_tan));
    if (_nrmPT.lengthSq() < 1e-6) _nrmPT.set(1, 0, 0).addScaledVector(_tan, -_tan.x);
    _nrmPT.normalize();
    _bin.crossVectors(_tan, _nrmPT);
    const r = r0 + (r1 - r0) * (i / (TUBE_RINGS - 1));
    for (let j = 0; j < TUBE_SIDES; j++) {
      const a = (j / TUBE_SIDES) * Math.PI * 2;
      const ca = Math.cos(a), sa = Math.sin(a);
      const nx = _nrmPT.x * ca + _bin.x * sa;
      const ny = _nrmPT.y * ca + _bin.y * sa;
      const nz = _nrmPT.z * ca + _bin.z * sa;
      pos[k] = p.x + nx * r; pos[k + 1] = p.y + ny * r; pos[k + 2] = p.z + nz * r;
      nor[k] = nx; nor[k + 1] = ny; nor[k + 2] = nz;
      k += 3;
    }
  }
  geo.attributes.position.needsUpdate = true;
  geo.attributes.normal.needsUpdate = true;
}

function makeGrabber(m, opts) {
  const group = new THREE.Group();
  group.position.set(...opts.anchor);
  m.add(group);

  const mat = toon(opts.color);

  // invisible locators along the body — spikes and legs ride on these
  const balls = [];
  const n = opts.segments;
  for (let i = 0; i < n; i++) {
    const r = THREE.MathUtils.lerp(opts.baseR, opts.tipR, i / (n - 1));
    const loc = new THREE.Group();
    group.add(loc);
    balls.push(loc);
    if (opts.spikeEvery && i % opts.spikeEvery === 1) {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(r * 0.55, r * 1.7, 6), toon(opts.spikeColor));
      spike.position.y = r * 1.1;
      loc.add(spike);
    }
  }

  // one smooth tube + a back-facing shell for the marker outline
  const tube = new THREE.Mesh(makeTubeGeometry(), mat);
  tube.frustumCulled = false;
  group.add(tube);
  const shell = new THREE.Mesh(makeTubeGeometry(), new THREE.MeshBasicMaterial({ color: opts.dark, side: THREE.BackSide }));
  shell.frustumCulled = false;
  group.add(shell);

  // rounded ends so the tube never looks chopped
  const baseCap = new THREE.Mesh(new THREE.SphereGeometry(opts.baseR, 10, 8), mat);
  outline(baseCap, opts.dark, 1.2);
  group.add(baseCap);
  const tipCap = new THREE.Mesh(new THREE.SphereGeometry(opts.tipR, 10, 8), mat);
  outline(tipCap, opts.dark, 1.22);
  group.add(tipCap);

  const tip = opts.buildTip ? opts.buildTip() : null;
  if (tip) group.add(tip);

  const grabber = {
    group, balls, tip, tube, shell, tipCap,
    baseR: opts.baseR,
    tipR: opts.tipR,
    grabR: opts.grabR ?? opts.tipR,   // effective tip size for catching; big heads override
    cur: new THREE.Vector3(0, 0.4, 0.8),
    reach: opts.reach,
    closeSpeed: opts.closeSpeed,
    wiggle: opts.wiggle ?? 1,
    rest: opts.rest,
    phase: Math.random() * 10,
    cooldown: 0,
    aim: new THREE.Vector3(),   // heavily smoothed world-space aim point — slow to turn, easy to read
    aimInit: false,
    aimOffset: opts.aimOffset ? new THREE.Vector3(...opts.aimOffset) : null, // keeps paired arms apart
    tipWorld: new THREE.Vector3(),
  };
  (m.userData.grabbers ??= []).push(grabber);
  return grabber;
}

const _p = new THREE.Vector3(), _mid = new THREE.Vector3();
function layoutGrabber(gr) {
  const end = gr.cur;
  _mid.copy(end).multiplyScalar(0.5);
  _mid.y += 0.45 + Math.sin(gr.phase * 1.7) * 0.4 * gr.wiggle;
  _mid.x += Math.sin(gr.phase) * 0.5 * gr.wiggle;

  // sample the bezier (start is the local origin) and skin both tubes over it
  for (let i = 0; i < TUBE_RINGS; i++) {
    const t = i / (TUBE_RINGS - 1);
    const w = 2 * (1 - t) * t;
    _pts[i].set(
      _mid.x * w + end.x * t * t,
      _mid.y * w + end.y * t * t,
      _mid.z * w + end.z * t * t
    );
  }
  fillTube(gr.tube.geometry, gr.baseR, gr.tipR);
  fillTube(gr.shell.geometry, gr.baseR * 1.25 + 0.025, gr.tipR * 1.25 + 0.025);

  // locators ride the same curve (spikes, legs)
  const n = gr.balls.length;
  for (let i = 0; i < n; i++) {
    const t = (i + 1) / n;
    const w = 2 * (1 - t) * t;
    gr.balls[i].position.set(
      _mid.x * w + end.x * t * t,
      _mid.y * w + end.y * t * t,
      _mid.z * w + end.z * t * t
    );
  }

  gr.tipCap.position.copy(end);
  if (gr.tip) {
    gr.tip.position.copy(end);
    _dir.copy(end).sub(_pts[TUBE_RINGS - 2]);
    if (gr.tip.userData.upright) {
      // heads stay upright like the drawing — only turn to face where the body points
      gr.tip.position.y += gr.tip.userData.lift || 0;
      if (_dir.x * _dir.x + _dir.z * _dir.z > 1e-10) gr.tip.rotation.set(0, Math.atan2(_dir.x, _dir.z), 0);
    } else if (_dir.lengthSq() > 1e-10) {
      gr.tip.quaternion.setFromUnitVectors(Z_AXIS, _dir.normalize());
    }
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
      if (gr.aimOffset) desired.add(gr.aimOffset);
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
    gr.tipWorld.copy(gr.cur);
    if (gr.tip && gr.tip.userData.upright) gr.tipWorld.y += gr.tip.userData.lift || 0; // catch where the head IS
    gr.tipWorld.applyMatrix4(gr.group.matrixWorld);
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
      aimOffset: [side * 0.5, 0, 0],
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
    segments: 13, baseR: 0.34, tipR: 0.21, grabR: 0.46,
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

// ---------- Monsters (drawing #3: the whiteboard) ----------
function makeAsterisk(size, thickness, color) {
  const star = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(thickness, size, thickness), toon(color));
    bar.rotation.z = (i * Math.PI) / 3;
    star.add(bar);
  }
  return star;
}

// tall pole with a grey head and a red asterisk — it fishes for you from way up high
function makeLollipop() {
  const m = new THREE.Group();

  [-0.15, 0.15].forEach((x) => {
    const line = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 3.6, 8), toon(MARKER_TEAL));
    line.position.set(x, 1.8, 0);
    m.add(line);
  });
  const inner = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 3.6, 8), toon(MARKER_GREY));
  inner.position.set(0, 1.8, -0.05);
  m.add(inner);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.55, 16, 12), toon(MARKER_GREY));
  head.position.y = 4.0;
  outline(head, MARKER_GREY_DARK, 1.08);
  m.add(head);
  const star = makeAsterisk(0.62, 0.07, SPOKE_RED);
  star.position.set(0, 4.0, 0.5);
  m.add(star);

  // a teal fishing-line arm dangles from the top
  makeGrabber(m, {
    anchor: [0.4, 3.6, 0.2],
    color: MARKER_TEAL, dark: MARKER_TEAL_DARK,
    segments: 10, baseR: 0.12, tipR: 0.09,
    reach: 5, closeSpeed: 4.8, wiggle: 1.2,
    rest: (t) => new THREE.Vector3(Math.sin(t * 0.8) * 0.7, -2.3 + Math.sin(t * 1.2) * 0.4, 0.5),
    buildTip: () => {
      const tipStar = makeAsterisk(0.34, 0.05, SPOKE_RED);
      const hub = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), toon(MARKER_GREY));
      tipStar.add(hub);
      return tipStar;
    },
  });

  m.userData.kind = 'lollipop';
  m.userData.holdHeight = 4.5;
  return m;
}

// the peanut-headed grey monster: no arms — its whole long body attacks,
// tipped with the big peanut head (dot eyes, grey teeth, notched top)
function makePeanutHead() {
  const head = new THREE.Group();
  // one continuous curved band, like the drawing: a thick open curve
  // with a rounded notch at the top and rounded ends
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.26, 12, 28, 4.6), toon(MARKER_GREY));
  band.rotation.z = 2.24; // places the open notch at the top, slightly right
  band.scale.set(1, 1.18, 1);
  outline(band, MARKER_GREY_DARK, 1.09);
  head.add(band);
  // rounded ends of the band, flanking the notch — children of the band so they
  // inherit its exact rotate+stretch transform and land precisely on the open ends
  [0, 4.6].forEach((a) => {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 10), toon(MARKER_GREY));
    cap.position.set(Math.cos(a) * 0.42, Math.sin(a) * 0.42, 0);
    outline(cap, MARKER_GREY_DARK, 1.12);
    band.add(cap);
  });
  // two tiny dot eyes on the upper-left, like the drawing
  [[-0.3, 0.3], [-0.08, 0.4]].forEach(([x, y]) => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), flat(0x14141c));
    eye.position.set(x, y, 0.26);
    head.add(eye);
  });
  // the cluster of grey scribble teeth mid-face
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 3; col++) {
      const tooth = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 5), toon(0x6f7478));
      tooth.position.set((col - 1) * 0.15 + (row ? 0.05 : 0), -0.02 - row * 0.14, 0.22);
      head.add(tooth);
    }
  }
  head.userData.upright = true; // like the drawing: notch on top, face forward, always
  head.userData.lift = 0.5;
  return head;
}

function makeWorm() {
  const m = new THREE.Group();

  // curled tail loop with the red dot — the body sprouts from here
  const loop = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.13, 10, 16), toon(MARKER_GREY));
  loop.position.y = 0.45;
  outline(loop, MARKER_GREY_DARK, 1.12);
  m.add(loop);
  const dot = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), toon(SPOKE_RED));
  dot.position.y = 0.45;
  m.add(dot);

  const gr = makeGrabber(m, {
    anchor: [0, 0.5, 0.2],
    color: MARKER_GREY, dark: MARKER_GREY_DARK,
    segments: 12, baseR: 0.3, tipR: 0.22, grabR: 0.6,
    reach: 5.5, closeSpeed: 4.5, wiggle: 1.2,
    rest: (t) => new THREE.Vector3(Math.sin(t * 0.7) * 0.8, 1.9 + Math.sin(t * 1.1) * 0.5, 1.0),
    buildTip: makePeanutHead,
  });

  // red dangly legs hang off the body, like the drawing
  const legs = [];
  [2, 4, 6, 8].forEach((i) => {
    const pivot = new THREE.Group();
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.6, 6), toon(SPOKE_RED));
    leg.position.y = -0.42;
    pivot.add(leg);
    gr.balls[i].add(pivot);
    legs.push(pivot);
  });
  m.userData.legs = legs;

  m.userData.kind = 'worm';
  m.userData.holdHeight = 3.0;
  return m;
}

// the green stick alien with big black eyes and grabby twig hands
function makeAlien() {
  const m = new THREE.Group();

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 14), toon(ALIEN_GREEN));
  head.scale.set(0.85, 1.25, 0.8);
  head.position.y = 2.55;
  outline(head, ALIEN_GREEN_DARK, 1.08);
  m.add(head);
  [-1, 1].forEach((side) => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), flat(0x14141c));
    eye.scale.set(0.65, 1.5, 0.45);
    eye.rotation.z = -side * 0.25;
    eye.position.set(side * 0.15, 2.62, 0.28);
    m.add(eye);
  });
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.035, 0.02), flat(0x14141c));
  mouth.position.set(0, 2.22, 0.31);
  m.add(mouth);

  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.3, 8), toon(ALIEN_GREEN));
  torso.position.y = 1.6;
  m.add(torso);

  // a twig fan: three prongs spreading out like the drawing's cool hands and feet
  function twigFan(len, tiltX = 0) {
    const fan = new THREE.Group();
    [-0.55, 0, 0.55].forEach((a) => {
      const pivot = new THREE.Group();
      pivot.rotation.y = a;
      pivot.rotation.x = tiltX;
      const twig = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.02, len, 6), toon(ALIEN_GREEN));
      twig.rotation.x = Math.PI / 2;
      twig.position.z = len / 2;
      pivot.add(twig);
      fan.add(pivot);
    });
    return fan;
  }

  [-1, 1].forEach((side) => {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.0, 8), toon(ALIEN_GREEN));
    leg.position.set(side * 0.16, 0.55, 0);
    leg.rotation.z = -side * 0.18;
    m.add(leg);
    const foot = twigFan(0.4, 0.35); // splayed twig toes
    foot.position.set(side * 0.26, 0.08, 0.05);
    m.add(foot);
  });

  // two twiggy stick arms — one held high, one out to the side, like the drawing
  [-1, 1].forEach((side) => {
    makeGrabber(m, {
      anchor: [side * 0.12, 2.15, 0.05],
      color: ALIEN_GREEN, dark: ALIEN_GREEN_DARK,
      segments: 8, baseR: 0.09, tipR: 0.065,
      reach: 4.8, closeSpeed: 4.8, wiggle: 1.15,
      aimOffset: [side * 0.55, 0.15, 0],
      rest: (t) => new THREE.Vector3(
        side * (1.25 + Math.sin(t * 0.9) * 0.3),
        (side < 0 ? 1.7 : 0.9) + Math.sin(t * 1.1 + side) * 0.45,
        0.3
      ),
      buildTip: () => twigFan(0.46),
    });
  });

  m.userData.kind = 'alien';
  m.userData.holdHeight = 3.3;
  return m;
}

const MONSTER_MAKERS = [
  makePurpleMonster, makeGreenMonster, makeYellowWheel,
  makeSnake, makeDino, makeSnail, makeScribbleMonster,
  makeLollipop, makeWorm, makeAlien,
];

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

// remove any object tree and free its GPU buffers (shared assets — shadow geometry, textures — stay)
function disposeObject(obj) {
  scene.remove(obj);
  obj.traverse((o) => {
    if (o.geometry && o.geometry !== shadowGeo) o.geometry.dispose();
    if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((mt) => mt.dispose());
  });
}
const disposeMonster = disposeObject;

function caught(m) {
  if (catching) return;
  state.running = false;
  grabSound();
  catching = { m, t: 0, from: ball.position.clone(), baseY: m.position.y };
}

// ---------- Reset / start ----------
function resetGame() {
  for (const m of state.monsters) disposeMonster(m);
  for (const r of state.racks) disposeObject(r.group);
  for (const fp of state.flyingPins) disposeObject(fp.mesh);
  for (const fm of state.flyingMonsters) disposeMonster(fm.mesh);
  for (const s of state.shots) disposeObject(s.mesh);
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
      if (ud.legs) ud.legs.forEach((l, i) => { l.rotation.z = Math.sin(ud.bob * 1.6 + i * 2.1) * 0.35; });
      if (ud.kind === 'scribble') { ud.tangle.rotation.y += sdt * 1.6; ud.tangle.rotation.x += sdt * 0.9; }
      if (ud.kind === 'lollipop') m.rotation.z = Math.sin(ud.bob * 0.7) * 0.05; // tall pole sways

      m.updateMatrixWorld();
      updateGrabbers(m, dist, sdt, ball.position);

      // a grabber tip touching the ball: slow ball is caught, fast ball rips free.
      // thick tubes (snake/worm — the tube IS the body) also catch along their mid-body.
      const tipTouch = ud.grabbers.some((gr) => {
        if (gr.cooldown !== 0) return false;
        if (gr.tipWorld.distanceTo(ball.position) < GRAB_RADIUS + gr.grabR * m.scale.x) return true;
        if (gr.baseR >= 0.25) {
          const nLoc = gr.balls.length;
          for (let i = 3; i < nLoc - 1; i += 4) {
            const r = THREE.MathUtils.lerp(gr.baseR, gr.tipR, i / (nLoc - 1));
            _p.copy(gr.balls[i].position).applyMatrix4(gr.group.matrixWorld);
            if (_p.distanceTo(ball.position) < BALL_R + r * m.scale.x) return true;
          }
        }
        return false;
      });
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
    // (guarded so a shot can't knock anyone out on the very frame we got caught)
    if (state.running) state.shots = state.shots.filter((s) => {
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
      if (spent) disposeObject(s.mesh);
      return !spent;
    });

    // monsters hit by a shot fly off like pins
    if (state.running) for (const m of state.monsters) {
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
          disposeMonster(m);
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
          disposeObject(r.group);
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
          disposeMonster(fm.mesh);
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
          disposeObject(fp.mesh);
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
window.__game = { state, ball, camera, startGame, spawnMonster, update, render: () => renderer.render(scene, camera) };
