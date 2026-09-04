import * as THREE from 'three';
import { OutlineEffect } from 'three/addons/effects/OutlineEffect.js';
import './shell.css';
import { createJuice } from './juice.js';

// `?sim` in the URL disables the animation loop so tests (and headless checks) can
// step the game by hand through its window.__<game> hook. Every game exposes
// step(dt) and render() there.
export const SIM = new URLSearchParams(location.search).has('sim');

// Renderer, scene, camera, lights, marker outlines and the frame loop — the part of
// every game that used to be copy-pasted. Games add their world to app.scene and
// hand app.start() an update(dt) function.
export function createApp({
  background = 0xf8f5ec,
  fog = null, // { near, far } or { density }
  fov = 50,
  near = 0.1,
  far = 300,
  outline = { thickness: 0.0065, color: 0x2a2118 },
  hemi = { sky: 0xffffff, ground: 0xcfc4a8, intensity: 1.4 },
  sun = { color: 0xfff4e0, intensity: 1.2, position: [8, 20, 14] },
  maxDt = 0.05,
} = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.getElementById('app').appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(background);
  if (fog) {
    scene.fog = fog.density ? new THREE.FogExp2(background, fog.density) : new THREE.Fog(background, fog.near, fog.far);
  }

  const camera = new THREE.PerspectiveCamera(fov, window.innerWidth / window.innerHeight, near, far);
  scene.add(new THREE.HemisphereLight(hemi.sky, hemi.ground, hemi.intensity));
  const sunLight = new THREE.DirectionalLight(sun.color, sun.intensity);
  sunLight.position.set(...sun.position);
  scene.add(sunLight);

  const effect = outline
    ? new OutlineEffect(renderer, {
      defaultThickness: outline.thickness,
      defaultColor: new THREE.Color(outline.color).toArray(),
      defaultKeepAlive: true,
    })
    : null;

  const resizeCbs = [];
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    resizeCbs.forEach((cb) => cb());
  });

  const clock = new THREE.Clock();
  const app = {
    renderer, scene, camera, effect,
    sun: sunLight,
    input: null,      // set by the game so one-shot presses are cleared each frame
    updateFn: null,
    time: 0,          // simulated seconds (slows during hitstop)
    render() { (effect || renderer).render(scene, camera); },
    // one simulated frame; `raw` is wall-clock seconds, dt is scaled by hitstop
    step(raw) {
      app.juice.tick(raw);
      const dt = raw * app.juice.timeScale;
      app.time += dt;
      if (app.updateFn) app.updateFn(dt, raw);
      if (app.input) app.input.endFrame();
    },
    frame(raw = Math.min(clock.getDelta(), maxDt)) {
      app.step(raw);
      app.juice.beforeRender();
      app.render();
      app.juice.afterRender();
    },
    start(update) {
      app.updateFn = update;
      clock.getDelta();
      if (SIM) return;
      const tick = () => {
        requestAnimationFrame(tick);
        app.frame();
      };
      tick();
    },
    onResize(cb) { resizeCbs.push(cb); },
  };
  app.juice = createJuice(app);
  return app;
}
