import * as THREE from 'three';
import {
  PALETTE,
  toonMat,
  inkMat,
  wobble,
  eye,
  stickLimb,
  armAssembly,
} from './common.js';

// THE PLAYER: the kid's green cat — one big wide floating head, no body.
// Mismatched triangle ears, one big eye and one squished one, asterisk
// whiskers, a single white buck tooth, and two long ink stick arms coming
// straight out of the head, each ending in a green mitten fist.
//
// Contract (see bottom of common.js): group origin at ground y=0, face on +Z.
export function buildCat() {
  const HEAD_Y = 0.8; // face-center height; head bottom sits ~y=0.3 (it floats)

  const group = new THREE.Group();

  // Everything rides a "floater" pivoted at the head center, so the idle
  // bob + tilt rock the head around its own middle instead of the ground,
  // and never fight the game moving `group` itself.
  const floater = new THREE.Group();
  floater.position.y = HEAD_Y;
  group.add(floater);

  // ---- The head: one big wide rounded oval, ~1.5 x 1.0 x 0.9 ----
  const headGeo = new THREE.SphereGeometry(1, 24, 18);
  headGeo.scale(0.75, 0.5, 0.45);
  wobble(headGeo, 0.035, 11);
  const head = new THREE.Mesh(headGeo, toonMat(PALETTE.catGreen));
  floater.add(head);

  // ---- Ears: both green triangles, deliberately mismatched ----
  // Left (-X): tall, narrow, standing nearly vertical. Tip lands ~y=1.45.
  const earLeft = new THREE.Mesh(
    wobble(new THREE.ConeGeometry(0.15, 0.44, 10, 1), 0.02, 21),
    toonMat(PALETTE.catGreen)
  );
  earLeft.position.set(-0.38, 0.43, 0);
  earLeft.rotation.z = 0.06;

  // Right (+X): short, wide, flopped ~30 degrees outward.
  const earRight = new THREE.Mesh(
    wobble(new THREE.ConeGeometry(0.22, 0.3, 10, 1), 0.02, 22),
    toonMat(PALETTE.catGreen)
  );
  earRight.position.set(0.42, 0.35, 0);
  earRight.rotation.z = -0.52;
  floater.add(earLeft, earRight);

  // ---- Eyes: bigger circle on the +X side, small squished one on -X ----
  const eyeBig = eye(0.17, 0.19);
  eyeBig.position.set(0.3, 0.12, 0.4); // ~60% of head height, on the +Z face
  const eyeSmall = eye(0.12, 0.11, 0.04);
  eyeSmall.position.set(-0.28, 0.1, 0.41);
  eyeSmall.rotation.z = 0.1; // slightly cocked, like the marker slipped

  // Both pupils peek slightly down-left.
  eyeBig.userData.pupil.position.x -= 0.035;
  eyeBig.userData.pupil.position.y -= 0.035;
  eyeSmall.userData.pupil.position.x -= 0.025;
  eyeSmall.userData.pupil.position.y -= 0.025;
  floater.add(eyeBig, eyeSmall);

  // ---- Whiskers: three thin ink strokes per side, radiating like an
  // asterisk from the nose area (angled up / flat / angled down) ----
  const whiskerAngles = [0.38, 0.02, -0.34];
  whiskerAngles.forEach((a, i) => {
    const y = -0.05 - i * 0.012; // hand-drawn: the strokes don't share a point
    const wR = stickLimb(0.3, 0.015);
    wR.position.set(0.06, y, 0.465);
    wR.rotation.z = a;
    const wL = stickLimb(0.3, 0.015);
    wL.position.set(-0.06, y, 0.465);
    wL.rotation.z = Math.PI - a; // mirrored fan on the other side
    floater.add(wR, wL);
  });

  // ---- One white buck tooth hanging below the whisker center ----
  const toothGeo = new THREE.BoxGeometry(0.11, 0.16, 0.06, 2, 2, 2);
  wobble(toothGeo, 0.008, 31);
  const tooth = new THREE.Mesh(toothGeo, toonMat(0xffffff));
  tooth.position.set(0.015, -0.2, 0.45);
  tooth.rotation.z = -0.06;
  floater.add(tooth);

  // Tiny smile: two short angled ink strips flanking the tooth,
  // corners curling up like a shallow "w" around it.
  const smileGeo = new THREE.BoxGeometry(0.13, 0.022, 0.02);
  const smileLeft = new THREE.Mesh(smileGeo, inkMat());
  smileLeft.position.set(-0.12, -0.135, 0.46);
  smileLeft.rotation.z = -0.35;
  const smileRight = new THREE.Mesh(smileGeo, inkMat());
  smileRight.position.set(0.12, -0.135, 0.46);
  smileRight.rotation.z = 0.35;
  floater.add(smileLeft, smileRight);

  // ---- Arms: long ink stick arms straight out the sides of the head,
  // pivots at world (∓0.72, 0.55, 0). Right fist drawn bigger and lumpier. ----
  const left = armAssembly(-1, 1.0, 0.2, PALETTE.catGreen);
  left.pivot.position.set(-0.72, -0.25, 0); // floater-local; world y = 0.55
  const right = armAssembly(1, 1.0, 0.26, PALETTE.catGreen);
  right.pivot.position.set(0.72, -0.25, 0);
  floater.add(left.pivot, right.pivot);

  // ---- Idle: gentle float-bob with a lazy tilt (deterministic, smooth) ----
  function idle(t) {
    floater.position.y = HEAD_Y + Math.sin(t * 1.7) * 0.06;
    floater.rotation.z = Math.sin(t * 1.15 + 0.9) * 0.04;
  }

  return {
    group,
    radius: 0.85,
    height: 1.45, // left ear tip
    headY: HEAD_Y,
    arms: { left, right },
    idle,
  };
}
