import * as THREE from 'three';

// ---------- The paper everything is drawn on ----------
export const PAPER = 0xf8f5ec;
export const INK = 0x2a2118;

// ---------- 3-tone gradient => the marker-shading look shared by every game ----------
let _gradient = null;
export function gradientMap() {
  if (_gradient) return _gradient;
  const data = new Uint8Array([110, 110, 110, 255, 200, 200, 200, 255, 255, 255, 255, 255]);
  _gradient = new THREE.DataTexture(data, 3, 1, THREE.RGBAFormat);
  _gradient.minFilter = THREE.NearestFilter;
  _gradient.magFilter = THREE.NearestFilter;
  _gradient.needsUpdate = true;
  return _gradient;
}

// ---------- Outlines ----------
// The renderer's OutlineEffect (installed by createApp) draws every mesh's outline in
// screen space with constant thickness. Per-material overrides live in userData:
// a colour (the kid's dark marker for that shape) or `false` for no outline at all.
export function setOutline(material, outline, thickness) {
  if (outline === false) material.userData.outlineParameters = { visible: false };
  else if (outline !== undefined && outline !== null) {
    material.userData.outlineParameters = {
      color: new THREE.Color(outline).toArray(),
      thickness: thickness ?? 0.0075,
    };
  }
  return material;
}
export const noOutline = (m) => setOutline(m, false);
export const outlineTint = (m, color, thickness) => setOutline(m, color, thickness);

// ---------- Cached materials ----------
// Meshes with the same look share one material, so spawning a monster no longer
// allocates (and later disposes) a material per body part. Pass `unique: true`
// when you intend to mutate the material — emissive flashes, colour swaps.
const toonCache = new Map();
const flatCache = new Map();
const keyOf = (color, outline, thickness) =>
  `${color}|${outline === false ? 'none' : outline ?? 'ink'}|${thickness ?? ''}`;

export function toonMat(color, opts = {}) {
  const { outline, thickness, unique = false, ...rest } = opts;
  const cacheable = !unique && Object.keys(rest).length === 0;
  const key = keyOf(color, outline, thickness);
  if (cacheable && toonCache.has(key)) return toonCache.get(key);
  const m = new THREE.MeshToonMaterial({ color, gradientMap: gradientMap(), ...rest });
  setOutline(m, outline, thickness);
  if (cacheable) toonCache.set(key, m);
  return m;
}

// Flat unlit fills: pupils, pen lines, teeth. Not outlined unless asked.
export function flatMat(color, opts = {}) {
  const { outline = false, thickness, unique = false, ...rest } = opts;
  const cacheable = !unique && Object.keys(rest).length === 0;
  const key = keyOf(color, outline, thickness);
  if (cacheable && flatCache.has(key)) return flatCache.get(key);
  const m = new THREE.MeshBasicMaterial({ color, ...rest });
  setOutline(m, outline, thickness);
  if (cacheable) flatCache.set(key, m);
  return m;
}

// A textured unlit plane (faces, nets, flat flame puffs). Never outlined.
export function spriteMat(map, opts = {}) {
  return noOutline(new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, ...opts }));
}

// ---------- Blob shadows: one shared disc, one shared material per look ----------
const shadowGeo = new THREE.CircleGeometry(1, 20).rotateX(-Math.PI / 2);
const shadowMats = new Map();
export function blobShadow(radius, { y = 0.02, opacity = 0.6, color = 0xd6cdb9 } = {}) {
  const k = `${color}|${opacity}`;
  if (!shadowMats.has(k)) {
    shadowMats.set(k, noOutline(new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false })));
  }
  const s = new THREE.Mesh(shadowGeo, shadowMats.get(k));
  s.scale.setScalar(radius);
  s.position.y = y;
  return s;
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

// ---------- Hull outline for INSTANCED meshes ----------
// OutlineEffect's vertex shader is not instance-aware (its outline direction ignores
// instanceMatrix), so instanced props get a back-face copy that shares the
// instanceMatrix buffer. `thickness` is in world units; the copy is scaled about the
// geometry's centre so box edges stay closed. Keep `hull.count` in sync with the mesh.
export function instancedHull(mesh, { color = INK, thickness = 0.06 } = {}) {
  const geo = mesh.geometry.clone();
  geo.computeBoundingBox();
  const bb = geo.boundingBox;
  const c = bb.getCenter(new THREE.Vector3());
  const size = bb.getSize(new THREE.Vector3());
  geo.translate(-c.x, -c.y, -c.z);
  geo.scale(
    (size.x + 2 * thickness) / Math.max(size.x, 1e-6),
    (size.y + 2 * thickness) / Math.max(size.y, 1e-6),
    (size.z + 2 * thickness) / Math.max(size.z, 1e-6),
  );
  geo.translate(c.x, c.y, c.z);
  const hull = new THREE.InstancedMesh(
    geo,
    noOutline(new THREE.MeshBasicMaterial({ color, side: THREE.BackSide })),
    mesh.count,
  );
  hull.instanceMatrix = mesh.instanceMatrix; // shared buffer: move the original, both move
  hull.frustumCulled = mesh.frustumCulled;
  noOutline(mesh.material);
  return hull;
}

// ---------- Canvas-drawn textures ----------
export function canvasTex(size, draw, { wrap = false, repeat = null } = {}) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (wrap) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (repeat) t.repeat.set(repeat[0], repeat[1]);
  return t;
}

// The speckled paper every ground plane uses.
export function paperTexture() {
  return canvasTex(256, (g) => {
    g.fillStyle = '#f8f5ec';
    g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 140; i++) {
      g.fillStyle = Math.random() < 0.5 ? '#efeadd' : '#f1ece0';
      g.beginPath();
      g.arc(Math.random() * 256, Math.random() * 256, 1 + Math.random() * 2.2, 0, Math.PI * 2);
      g.fill();
    }
  }, { wrap: true });
}

// A hand-drawn marker star (hit sparks, score bursts).
export function starTexture(fill = '#fff9d9', stroke = '#2a2118', points = 8) {
  return canvasTex(128, (ctx) => {
    ctx.translate(64, 64);
    ctx.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const r = i % 2 ? 22 : 56;
      const a = (i / (points * 2)) * Math.PI * 2;
      ctx[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 7;
    ctx.fill();
    ctx.stroke();
  });
}

export const clamp = THREE.MathUtils.clamp;
export const lerp = THREE.MathUtils.lerp;
// exponential smoothing factor for a frame of dt at rate k
export const smooth = (k, dt) => 1 - Math.exp(-k * dt);
// shortest signed angle difference
export function angleDiff(target, current) {
  let d = target - current;
  d = ((d % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2) - Math.PI;
  return d;
}
