import * as THREE from 'three';
import {
  PALETTE,
  toonMat,
  inkMat,
  noOutline,
  outlineTint,
  wobble,
  blob,
  stickLimb,
  fist,
} from './common.js';

// THE EMPEROR (הקיסר): by far the tallest figure on the page — a wavy
// white ribbon-creature like a wobbly inflatable tube standing upright.
// The kid drew him in purple marker, so the purple is his OUTLINE and the
// fill stays paper-white. Brown sock of a base, a tiny unimpressed face
// way up high, little pen dashes down his front, and long stick arms.
//
// Contract (see bottom of common.js): group origin at ground y=0, face on +Z.

const R_BASE = 0.3; // tube radius low on the body
const R_TOP = 0.24; // slightly thinner near the top
const TUBULAR = 28;
const RADIAL = 12;

function smooth01(x) {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
}

// Radius multiplier along the spine: 1 low down, easing to R_TOP/R_BASE up top.
function taperFactor(t) {
  return 1 - (1 - R_TOP / R_BASE) * smooth01((t - 0.45) / 0.55);
}

// Point on the spine closest to a given height, plus the local tube radius —
// used to glue face bits and pen dashes onto the wandering front surface.
function spineAtY(spine, y) {
  let bestT = 0;
  let bestD = Infinity;
  const p = new THREE.Vector3();
  for (let i = 0; i <= 120; i++) {
    const t = i / 120;
    spine.getPointAt(t, p);
    const d = Math.abs(p.y - y);
    if (d < bestD) {
      bestD = d;
      bestT = t;
    }
  }
  return { point: spine.getPointAt(bestT), radius: R_BASE * taperFactor(bestT) };
}

export function buildEmperor() {
  const group = new THREE.Group();

  // Everything except the planted base rides an inner group pivoted at the
  // ground, so idle() can bend the whole tube like an inflatable tube-man
  // without fighting the game moving `group` itself.
  const body = new THREE.Group();
  group.add(body);

  // ---- The tall gently-S-curved tube, ~3.0 high: two lazy waves ----
  const spine = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.15, 0),
    new THREE.Vector3(0.18, 0.8, 0),
    new THREE.Vector3(-0.15, 1.6, 0),
    new THREE.Vector3(0.12, 2.3, 0),
    new THREE.Vector3(0, 2.95, 0),
  ]);

  const tubeGeo = new THREE.TubeGeometry(spine, TUBULAR, R_BASE, RADIAL, false);
  // Taper toward the top: pull each ring's vertices in toward the spine.
  // (TubeGeometry lays vertices out ring-major, RADIAL + 1 verts per ring.)
  {
    const pos = tubeGeo.attributes.position;
    const v = new THREE.Vector3();
    const c = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      const t = Math.min(Math.floor(i / (RADIAL + 1)) / TUBULAR, 1);
      spine.getPointAt(t, c);
      v.set(pos.getX(i), pos.getY(i), pos.getZ(i))
        .sub(c)
        .multiplyScalar(taperFactor(t))
        .add(c);
      pos.setXYZ(i, v.x, v.y, v.z);
    }
  }
  wobble(tubeGeo, 0.028, 41);

  // Paper-white fill; the game's OutlineEffect draws him in purple marker.
  const bodyMat = toonMat(PALETTE.paper);
  outlineTint(bodyMat, PALETTE.purple);
  const tube = new THREE.Mesh(tubeGeo, bodyMat);
  body.add(tube);

  // Rounded top: a matching squashed blob capping the tube's open end.
  const cap = new THREE.Mesh(blob(0.26, { amp: 0.028, seed: 42 }), bodyMat);
  cap.position.y = 2.93;
  cap.scale.y = 0.7;
  body.add(cap);

  // ---- Brown rounded base — a sock he's planted in ----
  const base = new THREE.Mesh(blob(0.5, { seed: 43 }), toonMat(PALETTE.baseBrown));
  base.scale.y = 0.6;
  base.position.y = 0.22;
  group.add(base);

  // ---- Tiny, slightly unimpressed face way up high on the +Z side ----
  const ink = inkMat();
  const faceAt = spineAtY(spine, 2.55);
  const face = new THREE.Group();
  face.position.set(faceAt.point.x, 2.55, 0);
  body.add(face);

  // Front-surface z for a horizontal offset dx from the spine at face height.
  const surfZ = (dx) =>
    Math.sqrt(Math.max(faceAt.radius * faceAt.radius - dx * dx, 0.0004));

  // Two small dot-dash eyes: short horizontal ink strips.
  const eyeGeo = new THREE.BoxGeometry(0.1, 0.028, 0.06);
  for (const side of [-1, 1]) {
    const dash = new THREE.Mesh(eyeGeo, ink);
    dash.position.set(side * 0.11, 0.05, surfZ(0.11) + 0.01);
    face.add(dash);
  }
  // A tiny straight line of a mouth.
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.022, 0.06), ink);
  mouth.position.set(0, -0.1, surfZ(0) + 0.01);
  face.add(mouth);

  // ---- The kid's little pen marks down the middle of his front ----
  const dashGeo = new THREE.BoxGeometry(0.026, 0.11, 0.06);
  [1.2, 1.6, 2.0].forEach((y, i) => {
    const at = spineAtY(spine, y);
    const dash = new THREE.Mesh(dashGeo, ink);
    dash.position.set(at.point.x, y, at.radius + 0.012);
    dash.rotation.z = i % 2 === 0 ? 0.07 : -0.07; // strokes never quite straight
    body.add(dash);
  });

  // ---- Bug arms: the kid's blue zigzags are HIS — bent mantis arms ----
  // Each arm is two segments with an elbow: upper segment raised up-and-out,
  // forearm hanging down-forward like a praying mantis ready to strike.
  // The game still swings pivot.rotation.y to attack, so the whole bent arm
  // whips forward in one piece.
  const blueLimb = noOutline(new THREE.MeshBasicMaterial({ color: PALETTE.markerBlue }));
  const makeBugArm = (side) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.24, 2.08, 0);

    const upperWrap = new THREE.Group();
    upperWrap.rotation.z = side * 0.95; // raised steeply, like the drawing's V
    const upper = stickLimb(0.62, 0.05);
    upper.material = blueLimb;
    if (side < 0) upper.scale.x = -1;
    upperWrap.add(upper);

    const elbow = new THREE.Group();
    elbow.position.x = side * 0.62;
    elbow.rotation.z = side * -2.1; // sharp bend back down — the bug joint
    const forearm = stickLimb(0.55, 0.045);
    forearm.material = blueLimb;
    if (side < 0) forearm.scale.x = -1;
    const claw = fist(0.15, PALETTE.markerBlue, { spiky: true, seed: side < 0 ? 21 : 22 });
    claw.position.x = side * 0.62;
    elbow.add(forearm, claw);
    upperWrap.add(elbow);

    pivot.add(upperWrap);
    body.add(pivot);
    return { pivot, fist: claw };
  };
  const left = makeBugArm(-1);
  const right = makeBugArm(1);

  // ---- Idle: the inflatable-tube-man sway, bending from the base ----
  function idle(t) {
    body.rotation.z = Math.sin(t * 0.9) * 0.06;
    body.rotation.x = Math.sin(t * 0.7) * 0.04;
  }

  return {
    group,
    radius: 0.55,
    height: 3.0,
    headY: 2.55,
    arms: { left, right },
    idle,
  };
}
