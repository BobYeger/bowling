import * as THREE from 'three';

// ---------- Marker-on-paper palette (matches the kids' drawings) ----------
export const PALETTE = {
  paper: 0xf8f5ec,       // the page everything is drawn on
  ink: 0x2a2118,         // black marker outlines / stick limbs
  catGreen: 0x74b26d,    // player cat-head fill
  catGreenDark: 0x4d8a47,
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

// ---------- Shared 3-tone gradient map => marker-style cel shading ----------
let _gradient = null;
export function toonGradient() {
  if (_gradient) return _gradient;
  const data = new Uint8Array([110, 110, 110, 255, 200, 200, 200, 255, 255, 255, 255, 255]);
  _gradient = new THREE.DataTexture(data, 3, 1, THREE.RGBAFormat);
  _gradient.minFilter = THREE.NearestFilter;
  _gradient.magFilter = THREE.NearestFilter;
  _gradient.needsUpdate = true;
  return _gradient;
}

export function toonMat(color, opts = {}) {
  const m = new THREE.MeshToonMaterial({ color, gradientMap: toonGradient(), ...opts });
  return m;
}

// Stick limbs are already "ink", they need no outline shell.
export function inkMat() {
  const m = new THREE.MeshBasicMaterial({ color: PALETTE.ink });
  noOutline(m);
  return m;
}

// OutlineEffect (used by the game renderer) reads these per-material params.
export function noOutline(material) {
  material.userData.outlineParameters = { visible: false };
  return material;
}
export function outlineTint(material, color, thickness = 0.0075) {
  material.userData.outlineParameters = { color: new THREE.Color(color).toArray(), thickness };
  return material;
}

// ---------- Hand-drawn wobble: displace vertices with a deterministic hash ----------
function hash3(x, y, z, seed) {
  let h = Math.imul(Math.round(x * 173), 0x27d4eb2d) ^ Math.imul(Math.round(y * 289), 0x165667b1)
    ^ Math.imul(Math.round(z * 233), 0x9e3779b1) ^ Math.imul(seed, 0x85ebca77);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  return (((h ^ (h >>> 13)) >>> 0) / 4294967296) * 2 - 1;
}
export function wobble(geometry, amp = 0.045, seed = 1) {
  const pos = geometry.attributes.position;
  const n = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    n.set(pos.getX(i), pos.getY(i), pos.getZ(i));
    const d = hash3(n.x * 7, n.y * 7, n.z * 7, seed) * amp;
    const len = n.length() || 1;
    pos.setXYZ(i, n.x + (n.x / len) * d, n.y + (n.y / len) * d, n.z + (n.z / len) * d);
  }
  geometry.computeVertexNormals();
  return geometry;
}

// A lumpy hand-drawn ball (fists, blobs, canopies).
export function blob(r = 0.3, opts = {}) {
  const { detail = 2, amp = r * 0.16, seed = 3 } = opts;
  return wobble(new THREE.IcosahedronGeometry(r, detail), amp, seed);
}

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
  const mesh = new THREE.Mesh(geo, toonMat(PALETTE.crownYellow));
  return mesh;
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
