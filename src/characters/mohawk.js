// היצור עם השיער הירוק — "the creature with the green hair".
// A scrappy little punk drawn in solid blue marker: rocket-pill body, an
// electric semi-transparent spiky aura, a green scribbled mohawk, angry brows,
// "O I O" chest markings, spiky fists and wide three-toed feet. He never
// stops shivering.
import * as THREE from 'three';
import {
  PALETTE, toonMat, inkMat, noOutline, wobble, blob, eye, armAssembly,
} from './common.js';

export function buildMohawk() {
  const group = new THREE.Group();
  // All parts live in an inner group so idle() can jitter it; the game owns
  // the outer group's transform.
  const inner = new THREE.Group();
  group.add(inner);

  const blueToon = toonMat(PALETTE.markerBlue);            // filled shapes (outlined by OutlineEffect)
  const blueInk = noOutline(new THREE.MeshBasicMaterial({ color: PALETTE.markerBlue })); // blue "ink" sticks

  // ---- Body: solid blue rounded pill, narrowing at the top like a rocket nose
  const BODY_Y = 0.85; // body center height
  const bodyGeo = new THREE.CapsuleGeometry(0.3, 0.35, 6, 16); // 0.95 tall
  const halfH = 0.475;
  const pos = bodyGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    if (y > 0) {
      const s = 1 - 0.24 * (y / halfH); // rocket-nose taper
      pos.setX(i, pos.getX(i) * s);
      pos.setZ(i, pos.getZ(i) * s);
    }
  }
  wobble(bodyGeo, 0.028, 21);
  const body = new THREE.Mesh(bodyGeo, blueToon);
  body.position.y = BODY_Y;
  inner.add(body);

  // ---- Spiky electric aura (his signature) — pulsed in idle()
  const aura = new THREE.Mesh(
    blob(0.75, { amp: 0.3, detail: 1, seed: 9 }),
    noOutline(toonMat(PALETTE.lightBlue, { transparent: true, opacity: 0.45, depthWrite: false })),
  );
  aura.position.y = BODY_Y;
  inner.add(aura);

  // ---- Green mohawk: 6 thin blades fanned front-to-back along the crown
  const bladeHeights = [0.38, 0.47, 0.55, 0.52, 0.44, 0.36];
  for (let i = 0; i < bladeHeights.length; i++) {
    const h = bladeHeights[i];
    const z = 0.12 - i * 0.056; // +0.12 .. -0.16
    const blade = new THREE.Mesh(
      wobble(new THREE.ConeGeometry(0.05, h, 5, 1), 0.012, 30 + i),
      toonMat(PALETTE.hairGreen),
    );
    blade.scale.x = 0.55; // thin marker-stroke blade
    const baseY = 1.3 - Math.abs(z) * 0.4; // follow the dome
    blade.position.set(0, baseY + h / 2 - 0.01, z);
    blade.rotation.x = 0.3 - i * 0.13;                 // fanned crest
    blade.rotation.z = (i % 2 === 0 ? 1 : -1) * 0.11;  // scribbly alternating tilt
    inner.add(blade);
  }

  // ---- Angry face (+Z)
  const eyeL = eye(0.09, 0.1);
  eyeL.position.set(-0.11, 1.18, 0.19);
  const eyeR = eye(0.09, 0.1);
  eyeR.position.set(0.11, 1.18, 0.19);
  const browGeo = new THREE.BoxGeometry(0.17, 0.05, 0.035);
  const browL = new THREE.Mesh(browGeo, inkMat());
  browL.position.set(-0.11, 1.27, 0.16);
  browL.rotation.z = -0.45; // inner ends dip — furious
  const browR = new THREE.Mesh(browGeo, inkMat());
  browR.position.set(0.11, 1.27, 0.16);
  browR.rotation.z = 0.45;
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.028, 0.03), inkMat());
  mouth.position.set(0.02, 1.08, 0.26);
  mouth.rotation.z = 0.3; // little slanted grimace
  inner.add(eyeL, eyeR, browL, browR, mouth);

  // ---- "O I O" chest markings
  const ringGeo = new THREE.TorusGeometry(0.09, 0.014, 6, 20);
  for (const side of [-1, 1]) {
    const ring = new THREE.Mesh(ringGeo, inkMat());
    ring.position.set(side * 0.16, 0.75, 0.25);
    ring.rotation.y = side * 0.45; // hug the pill's curve
    inner.add(ring);
  }
  const chestLine = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.17, 6), inkMat());
  chestLine.position.set(0, 0.75, 0.295);
  inner.add(chestLine);

  // ---- Arms: blue sticks with spiky electric fists
  const right = armAssembly(1, 0.8, 0.18, PALETTE.markerBlue, { spiky: true, seed: 6 });
  right.pivot.position.set(-0.34, 1.0, 0);
  const left = armAssembly(-1, 0.8, 0.18, PALETTE.markerBlue, { spiky: true, seed: 7 });
  left.pivot.position.set(0.34, 1.0, 0);
  right.arm.material = blueInk; // recolor ink sticks blue
  left.arm.material = blueInk;
  inner.add(right.pivot, left.pivot);

  // ---- Short stick legs + wide flat feet with three toes each
  const legGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.36, 7);
  const toeGeo = new THREE.SphereGeometry(0.045, 8, 6);
  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(legGeo, blueInk);
    leg.position.set(side * 0.12, 0.2, 0);
    inner.add(leg);
    const foot = new THREE.Mesh(blob(0.16, { seed: side < 0 ? 11 : 12 }), blueToon);
    foot.scale.set(1.15, 0.38, 1.3); // wide + flat
    foot.position.set(side * 0.12, 0.07, 0.05);
    inner.add(foot);
    for (let ti = -1; ti <= 1; ti++) { // three toes poking out the front
      const toe = new THREE.Mesh(toeGeo, blueToon);
      toe.position.set(side * 0.12 + ti * 0.062, 0.05, 0.24 + (ti === 0 ? 0.02 : 0));
      inner.add(toe);
    }
  }

  // ---- Jittery idle: fast shivers + electric aura pulse (~6 Hz)
  function idle(t) {
    inner.position.x = Math.sin(t * 13) * 0.015 + Math.sin(t * 7.3) * 0.01;
    inner.rotation.z = Math.sin(t * 11) * 0.02;
    aura.scale.setScalar(1 + Math.sin(t * 37.7) * 0.06);
  }

  return {
    group,
    radius: 0.55,
    height: 1.85,
    headY: 1.25,
    arms: { left, right },
    aura,
    idle,
  };
}
