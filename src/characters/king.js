import * as THREE from 'three';
import {
  PALETTE,
  toonMat,
  inkMat,
  outlineTint,
  wobble,
  blob,
  crown,
} from './common.js';

// המלך — "the King".
// The kid's drawing: a smallish round head outlined in TAN with a happy
// dot-eyed face, a yellow zigzag crown scribbled half onto the hair, and one
// BIG BLUE-OUTLINED CRESCENT for a body — sweeping from behind the head
// down to a point near the ground. NO arms: the crescent is his tail,
// and he fights by whipping it around himself.

const HEAD_R = 0.34;
const HEAD_Y = 1.8;
const BODY_FILL = 0xeef3fb; // paper with a faint blue tint

export function buildKing() {
  const group = new THREE.Group();

  // ---------- body: the signature blue-outlined crescent ----------
  // One marker stroke: starts up behind the head, bows out to the king's
  // side, curves back in to a near-ground tip.
  const spine = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.10, 1.75, -0.05), // up behind the head
    new THREE.Vector3(0.42, 1.38, -0.02),
    new THREE.Vector3(0.45, 1.0, 0.0),    // outward bulge
    new THREE.Vector3(0.24, 0.5, 0.03),
    new THREE.Vector3(-0.15, 0.12, 0.05), // near-ground tip
  ]);
  const TUBULAR = 44;
  const RADIAL = 12;
  // Build at radius 1, wobble, then taper each ring 0.34 -> 0.05 by
  // rescaling it around its own spine point (custom-radius tube).
  const bodyGeo = new THREE.TubeGeometry(spine, TUBULAR, 1, RADIAL, false);
  wobble(bodyGeo, 0.05, 11); // noise shrinks with the taper => even wobble
  const pos = bodyGeo.attributes.position;
  const ringC = new THREE.Vector3();
  for (let i = 0; i <= TUBULAR; i++) {
    const t = i / TUBULAR;
    spine.getPointAt(t, ringC);
    const r = 0.34 + (0.05 - 0.34) * t;
    for (let j = 0; j <= RADIAL; j++) {
      const k = i * (RADIAL + 1) + j;
      pos.setXYZ(
        k,
        ringC.x + (pos.getX(k) - ringC.x) * r,
        ringC.y + (pos.getY(k) - ringC.y) * r,
        ringC.z + (pos.getZ(k) - ringC.z) * r,
      );
    }
  }
  bodyGeo.computeVertexNormals();

  const bodyMat = outlineTint(toonMat(BODY_FILL), PALETTE.markerBlue);
  const body = new THREE.Mesh(bodyGeo, bodyMat);

  // Close the stroke's ends: a fat lump tucked behind the head, a knot
  // at the ground tip (it doubles as the "fist" that pops on a whip hit).
  const capTop = new THREE.Mesh(blob(0.35, { amp: 0.02, seed: 12 }), bodyMat);
  capTop.position.copy(spine.points[0]);
  const capTip = new THREE.Mesh(blob(0.11, { amp: 0.012, seed: 13 }), bodyMat);
  capTip.position.copy(spine.points[spine.points.length - 1]);

  // The whole crescent rides a pivot on the king's vertical axis — the game
  // swings pivot.rotation.y to attack, whipping the tail around his body.
  const tailPivot = new THREE.Group();
  tailPivot.add(body, capTop, capTip);
  group.add(tailPivot);

  // ---------- head: pale skin fill, tan marker outline ----------
  const headMat = outlineTint(toonMat(PALETTE.paleSkin), PALETTE.kingTan);
  const head = new THREE.Mesh(
    wobble(new THREE.SphereGeometry(HEAD_R, 22, 16), 0.012, 2),
    headMat,
  );
  head.position.y = HEAD_Y;
  group.add(head);

  // ---------- face (+Z): two ink dots + a thin smile, nothing else ----------
  const dotGeo = new THREE.SphereGeometry(0.034, 10, 8);
  const eyeL = new THREE.Mesh(dotGeo, inkMat());
  eyeL.position.set(-0.11, 0.05, 0.318); // on the head surface
  const eyeR = new THREE.Mesh(dotGeo, inkMat());
  eyeR.position.set(0.11, 0.05, 0.318);

  const SMILE_ARC = 1.6;
  const smileGeo = new THREE.TorusGeometry(0.1, 0.014, 6, 16, SMILE_ARC);
  smileGeo.rotateZ(Math.PI + (Math.PI - SMILE_ARC) / 2); // bottom-centred arc
  const smile = new THREE.Mesh(smileGeo, inkMat());
  smile.position.set(0, -0.105, 0.318);
  smile.rotation.x = 0.36; // hug the cheek curve
  head.add(eyeL, eyeR, smile);

  // ---------- crown: scribbled half onto the hair, a little crooked ----------
  const kingCrown = crown(0.5, 0.22, 4);
  kingCrown.position.set(0.05, 1.92, 0);
  kingCrown.rotation.z = 0.15;
  group.add(kingCrown);

  // ---------- no arms: both "arms" are the same tail whip ----------
  // Alternating attacks swing pivot.rotation.y with opposite signs, so the
  // crescent whips around him left, then right.
  const whip = { pivot: tailPivot, fist: capTip };

  return {
    group,
    radius: 0.6,
    height: 2.15,
    headY: HEAD_Y,
    arms: { left: whip, right: whip },
    idle(t) {
      // proud slow bounce
      group.scale.y = 1 + Math.sin(t * 2.1) * 0.02;
    },
  };
}
