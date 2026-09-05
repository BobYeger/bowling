import * as THREE from 'three';
import { toonMat as kitToon, noOutline, outlineTint, wobble, blob } from '../kit/toon.js';

// ---------- Marker-on-paper palette (matches the kids' drawings) ----------
// See drawings/punch-fighters-1.webp (the cat) and drawings/punch-fighters-2.webp
// (the emperor, the king, the queen and the creature with the green mohawk).
export const PALETTE = {
  paper: 0xf8f5ec,       // the page everything is drawn on
  ink: 0x2a2118,         // black marker outlines / stick limbs
  catGreen: 0x74b26d,    // player cat-head fill
  catGreenDark: 0x4d8a47,
  catBlue: 0x5b8fd6,     // the second player's cat
  catBlueDark: 0x2f5fa8,
  markerBlue: 0x3d7fc7,  // kid's blue marker (king body, queen, mohawk creature)
  lightBlue: 0xa5cbe8,   // mohawk creature's spiky aura
  purple: 0x9061b8,      // emperor's tall body outline
  crownYellow: 0xf4c81f, // king + queen crowns
  kingTan: 0xc59a66,     // king's head outline color
  paleSkin: 0xf3e4c8,    // king head fill (paper with a tan tint)
  baseBrown: 0xb4763f,   // emperor's bottom
  hairGreen: 0x5cb85f,   // the creature's mohawk
  grassGreen: 0x3e9e4f,
};

// Characters tint outlines per body part, so every material here is its own instance
// (the kit's shared cache would leak one character's outline colour onto another).
export function toonMat(color, opts = {}) {
  return kitToon(color, { unique: true, ...opts });
}

// Stick limbs are already "ink", they need no outline shell.
export function inkMat() {
  return noOutline(new THREE.MeshBasicMaterial({ color: PALETTE.ink }));
}

export { noOutline, outlineTint, wobble, blob };

// ---------- Face parts ----------
// A cartoon eye: white oval + black pupil, looking along +Z.
export function eye(rx = 0.14, ry = 0.17, pupilR = 0.05) {
  const g = new THREE.Group();
  const white = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 12), toonMat(0xffffff));
  white.scale.set(rx, ry, Math.min(rx, ry) * 0.6);
  const pupil = new THREE.Mesh(new THREE.SphereGeometry(pupilR, 10, 8), inkMat());
  pupil.position.z = Math.min(rx, ry) * 0.58;
  g.add(white, pupil);
  g.userData.pupil = pupil;
  return g;
}

// ---------- Limbs ----------
// Thin ink stick along +X of length `len` (like the kids' single-stroke arms).
export function stickLimb(len = 0.9, r = 0.035) {
  const geo = new THREE.CylinderGeometry(r, r, len, 8, 1);
  geo.rotateZ(Math.PI / 2);
  geo.translate(len / 2, 0, 0);
  return new THREE.Mesh(geo, inkMat());
}

// A scribbly mitten fist. `spiky` gives the electric/fuzzy version.
export function fist(size = 0.22, color = PALETTE.catGreen, opts = {}) {
  const { spiky = false, seed = 5 } = opts;
  const geo = blob(size, { amp: size * (spiky ? 0.38 : 0.18), seed, detail: spiky ? 1 : 2 });
  return new THREE.Mesh(geo, toonMat(color));
}

// Shoulder pivot + stick arm + fist at the end.
// side: +1 = right arm (extends +X), -1 = left arm (extends -X).
// The game punches by swinging pivot.rotation.y toward the facing (+Z) direction.
export function armAssembly(side, len = 0.95, fistSize = 0.22, fistColor = PALETTE.catGreen, opts = {}) {
  const pivot = new THREE.Group();
  const arm = stickLimb(len);
  const hand = fist(fistSize, fistColor, opts);
  hand.position.x = len + fistSize * 0.4;
  if (side < 0) { arm.scale.x = -1; hand.position.x = -(len + fistSize * 0.4); }
  pivot.add(arm, hand);
  return { pivot, fist: hand, arm };
}

// ---------- Crown: the kid's yellow zigzag scribble ----------
export function crown(width = 0.5, height = 0.3, spikes = 4) {
  const shape = new THREE.Shape();
  shape.moveTo(-width / 2, 0);
  for (let i = 0; i < spikes; i++) {
    const x0 = -width / 2 + (i + 0.5) * (width / spikes);
    const x1 = -width / 2 + (i + 1) * (width / spikes);
    shape.lineTo(x0, height);
    shape.lineTo(x1, height * 0.12);
  }
  shape.lineTo(width / 2, -height * 0.28);
  shape.lineTo(-width / 2, -height * 0.28);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: width * 0.16, bevelEnabled: false });
  geo.translate(0, height * 0.28, -width * 0.08);
  return new THREE.Mesh(geo, toonMat(PALETTE.crownYellow));
}

// ---------- Character contract ----------
// Every build<Name>() in this folder returns:
// {
//   group,      // THREE.Group — origin at the ground, character faces +Z
//   radius,     // horizontal collision radius (world units)
//   height,     // top of head above ground
//   headY,      // height of face center (for hit sparks / speech)
//   arms: { left: {pivot, fist}, right: {pivot, fist} },
//               // pivots sit at the shoulders; at rest each arm points
//               // sideways (drawings have arms straight out), the game
//               // swings pivot.rotation.y to punch toward +Z
//   idle(t),    // optional — small personality motion, t = seconds
// }
