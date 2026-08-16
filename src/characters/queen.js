import * as THREE from 'three';
import {
  PALETTE, toonMat, inkMat, outlineTint,
  wobble, blob, crown,
} from './common.js';

// המלכה — the Queen.
// The kid drew her as ONE elegant curled shape — a thick ribbon curled into
// a relaxed "C" lying on its back, like a curled shrimp. No separate head:
// the face sits right on the curl, the yellow zigzag crown perches askew on
// its top end, and her whole face is a single serene winking eye drawn as a
// "V". Paper-white fill with the kid's blue marker outline.

// The curl's spine, head end first (up high), down and under, to the tail hook.
const SPINE = [
  new THREE.Vector3(0.15, 1.45, 0),   // head end, up high
  new THREE.Vector3(-0.35, 1.20, 0),  // arcing over the top
  new THREE.Vector3(-0.45, 0.55, 0),  // sweeping down and under
  new THREE.Vector3(0.15, 0.25, 0),   // curling forward along the ground
  new THREE.Vector3(0.45, 0.50, 0),   // hooking back up/inward
];
const HEAD_R = 0.30; // thick at the head end...
const TAIL_R = 0.10; // ...tapering to the tail hook

// One TubeGeometry along the spine, re-fit ring by ring so the radius tapers
// smoothly from HEAD_R to TAIL_R. TubeGeometry samples ring i at
// getPointAt(i / tubularSegments), so each ring can be rescaled about its
// exact spine point.
function curlGeometry(curve, tubularSegments = 56, radialSegments = 12) {
  const geo = new THREE.TubeGeometry(curve, tubularSegments, 1, radialSegments, false);
  const pos = geo.attributes.position;
  const ringSize = radialSegments + 1;
  const c = new THREE.Vector3();
  const v = new THREE.Vector3();
  for (let ring = 0; ring <= tubularSegments; ring++) {
    const t = ring / tubularSegments;
    const r = TAIL_R + (HEAD_R - TAIL_R) * Math.pow(1 - t, 1.2);
    curve.getPointAt(t, c);
    for (let j = 0; j < ringSize; j++) {
      const i = ring * ringSize + j;
      v.fromBufferAttribute(pos, i).sub(c).multiplyScalar(r).add(c);
      pos.setXYZ(i, v.x, v.y, v.z);
    }
  }
  return wobble(geo, 0.02, 17);
}

export function buildQueen() {
  const group = new THREE.Group();

  // Everything rides an inner "curl" group: idle rocks it, and the game
  // swings its rotation.y to attack — she whips her whole curled body
  // around like a figure skater. No arms, just as the kid drew her.
  const curl = new THREE.Group();
  group.add(curl);

  // ---- body: the big lazy "C", paper-white with a blue marker outline ----
  const bodyMat = outlineTint(toonMat(PALETTE.paper), PALETTE.markerBlue);
  const spine = new THREE.CatmullRomCurve3(SPINE);
  const body = new THREE.Mesh(curlGeometry(spine), bodyMat);

  // lumpy blobs cap the open tube ends (fat head end, tail hook — the
  // hook doubles as the "fist" that pops on a whip hit)
  const head = new THREE.Mesh(blob(HEAD_R, { amp: 0.03, seed: 8 }), bodyMat);
  head.position.copy(SPINE[0]);
  const tail = new THREE.Mesh(blob(TAIL_R + 0.03, { amp: 0.018, seed: 9 }), bodyMat);
  tail.position.copy(SPINE[SPINE.length - 1]);
  curl.add(body, head, tail);

  // ---- crown, perched slightly askew on the topmost point of the curl ----
  const tiara = crown(0.36, 0.18, 4);
  tiara.position.set(0.15, 1.69, 0);
  tiara.rotation.z = 0.12;
  curl.add(tiara);

  // ---- the face: one serene winking eye — a "V" of two ink strokes ----
  const face = new THREE.Group();
  face.position.set(0.15, 1.42, 0.30);
  const ink = inkMat();
  const winkL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.032, 0.05), ink);
  winkL.position.set(-0.058, 0.042, 0.02);
  winkL.rotation.z = -0.62;
  const winkR = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.032, 0.05), ink);
  winkR.position.set(0.062, 0.052, 0.02);
  winkR.rotation.z = 0.72;
  const beautyMark = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 6), ink);
  beautyMark.position.set(0.07, -0.11, -0.015);
  face.add(winkL, winkR, beautyMark);
  curl.add(face);

  // both "arms" are the same body whip, alternating direction
  const whip = { pivot: curl, fist: tail };

  return {
    group,
    radius: 0.6,
    height: 1.75,
    headY: 1.4,
    arms: { left: whip, right: whip },
    // queenly rocking: a slow sideways sway, rising a touch at each extreme
    // (on the inner curl — the game owns the outer group's transform)
    idle(t) {
      curl.rotation.z = Math.sin(t * 1.15) * 0.05;
      curl.position.y = (1 - Math.cos(t * 2.3)) * 0.01;
    },
  };
}
