import * as THREE from 'three';

// Game feel in one place: camera shake, hitstop (a moment of frozen time on a big
// hit), floating "+10" numbers projected from world space, and a squash-and-stretch
// spring for anything that lands or gets hit. Every game gets the same juice for free.
export function createJuice(app) {
  const layer = document.createElement('div');
  layer.id = 'popups';
  document.body.appendChild(layer);
  const pops = [];
  for (let i = 0; i < 14; i++) {
    const el = document.createElement('div');
    el.className = 'popnum';
    el.style.display = 'none';
    layer.appendChild(el);
    pops.push({ el, life: 0, max: 1, pos: new THREE.Vector3(), rise: 0 });
  }
  const springs = [];
  const st = { shake: 0, hitstop: 0, hitScale: 0.08, timeScale: 1, t: 0 };
  const saved = new THREE.Vector3();
  const _v = new THREE.Vector3();
  let shook = false;

  return {
    get timeScale() { return st.timeScale; },
    shake(amount = 0.3) { st.shake = Math.min(1, st.shake + amount); },
    hitstop(seconds = 0.08, scale = 0.08) { st.hitstop = Math.max(st.hitstop, seconds); st.hitScale = scale; },
    pop(worldPos, text, { color, size = 30, life = 0.9 } = {}) {
      const p = pops.find((x) => x.life <= 0) || pops[0];
      p.life = p.max = life;
      p.pos.copy(worldPos);
      p.rise = 0;
      p.el.textContent = text;
      p.el.style.color = color || '';
      p.el.style.fontSize = size + 'px';
      p.el.style.display = 'block';
    },
    // Kick a spring on an object's scale; it squashes, stretches and settles back.
    // Only for objects whose scale nothing else animates.
    bounce(obj, amount = 0.3) {
      let s = springs.find((x) => x.obj === obj);
      if (!s) { s = { obj, base: obj.scale.clone(), x: 0, v: 0 }; springs.push(s); }
      s.v += amount * 18;
    },
    tick(raw) {
      st.t += raw;
      st.hitstop = Math.max(0, st.hitstop - raw);
      st.timeScale = st.hitstop > 0 ? st.hitScale : 1;
      st.shake = Math.max(0, st.shake - raw * 1.8);
      for (const p of pops) {
        if (p.life <= 0) continue;
        p.life -= raw;
        p.rise += raw * 1.2;
        if (p.life <= 0) p.el.style.display = 'none';
      }
      for (let i = springs.length - 1; i >= 0; i--) {
        const s = springs[i];
        s.v += (-140 * s.x - 9 * s.v) * raw;
        s.x += s.v * raw;
        s.obj.scale.set(s.base.x * (1 + s.x * 0.6), s.base.y * (1 - s.x), s.base.z * (1 + s.x * 0.6));
        if (Math.abs(s.x) < 0.002 && Math.abs(s.v) < 0.02) { s.obj.scale.copy(s.base); springs.splice(i, 1); }
      }
    },
    beforeRender() {
      const cam = app.camera;
      const W = window.innerWidth, H = window.innerHeight;
      for (const p of pops) {
        if (p.life <= 0) continue;
        _v.copy(p.pos);
        _v.y += p.rise;
        _v.project(cam);
        if (_v.z > 1) { p.el.style.display = 'none'; continue; }
        const k = p.life / p.max;
        const grow = 0.8 + 0.4 * Math.min(1, (1 - k) * 4);
        p.el.style.transform = `translate(${(_v.x * 0.5 + 0.5) * W}px, ${(-_v.y * 0.5 + 0.5) * H}px) translate(-50%, -50%) scale(${grow})`;
        p.el.style.opacity = Math.min(1, k * 2.5);
      }
      shook = st.shake > 0;
      if (shook) {
        saved.copy(cam.position);
        const s = st.shake * st.shake;
        cam.position.x += Math.sin(st.t * 51) * s * 0.5;
        cam.position.y += Math.sin(st.t * 47) * s * 0.35;
      }
    },
    afterRender() { if (shook) app.camera.position.copy(saved); },
  };
}
