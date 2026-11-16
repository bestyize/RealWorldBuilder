import { Vector3 } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { startFishPreview } from '../../src/fish-preview.js';
import { route } from './route.js';
import { cardinalTetra } from './index.js';


function configureCamera(camera, canvas, fish, render) {
  const controls = new OrbitControls(camera, canvas);
  controls.enablePan = false;
  controls.minDistance = 6;
  controls.maxDistance = 28;
  controls.minPolarAngle = .36;
  controls.maxPolarAngle = Math.PI - .36;
  controls.rotateSpeed = .76;
  const center = new Vector3();
  const offset = new Vector3();
  const initialOffset = camera.position.clone().sub(controls.target);

  function followFish() {
    center.copy(fish.getMotion().center);
    center.y -= .05;
    camera.position.add(offset.subVectors(center, controls.target));
    controls.target.copy(center);
  }

  followFish();
  controls.update();
  controls.addEventListener('change', render);
  canvas.style.cursor = 'grab';
  canvas.removeAttribute('aria-hidden');
  canvas.tabIndex = 0;
  canvas.setAttribute('aria-label', '三维鱼体。用方向键旋转、加减键缩放，按 Home 还原视角。');
  function resetView() {
    camera.position.copy(controls.target).add(initialOffset);
    controls.update();
  }

  const keys = {
    ArrowLeft: () => controls.rotateLeft(.12),
    ArrowRight: () => controls.rotateLeft(-.12),
    ArrowUp: () => controls.rotateUp(.10),
    ArrowDown: () => controls.rotateUp(-.10),
    '+': () => controls.dollyIn(.88),
    '=': () => controls.dollyIn(.88),
    '-': () => controls.dollyOut(.88),
    Home: resetView,
  };
  canvas.addEventListener('keydown', (event) => {
    const action = keys[event.key];
    if (!action || event.altKey || event.ctrlKey || event.metaKey) return;
    event.preventDefault();
    action();
  });

  const hint = document.createElement('p');
  hint.textContent = '拖动旋转 · 滚动或双指缩放';
  hint.style.cssText = 'position:absolute;bottom:max(74px,calc(var(--safe-bottom) + 66px));'
    + 'right:max(12px,calc(var(--safe-right) + 8px));margin:0;color:#c2d1dc;font-size:12px;pointer-events:none';
  canvas.parentElement.append(hint);
  const mode = document.createElement('button');
  mode.type = 'button'; mode.id = 'tetra-mode'; mode.textContent = '观察单鱼';
  mode.setAttribute('aria-pressed', 'false');
  mode.style.cssText = 'position:absolute;top:max(66px,calc(var(--safe-top) + 60px));right:max(12px,calc(var(--safe-right) + 8px));padding:10px 14px;color:#e2ecf2;background:#142736;border:1px solid #365367;border-radius:8px;cursor:pointer';
  canvas.parentElement.append(mode);
  mode.addEventListener('click', () => {
    const single = fish.getCount() > 1;
    fish.setCount(single ? 1 : 10);
    mode.textContent = single ? '观察鱼群（10 条）' : '观察单鱼';
    mode.setAttribute('aria-pressed', String(single));
    const offset = camera.position.clone().sub(controls.target).normalize();
    camera.position.copy(controls.target).addScaledVector(offset, single ? 10 : 18);
    // The shared player's input handler updates absolute pose and pauses safely.
    document.querySelector('#preview-time').dispatchEvent(new Event('input'));
    controls.update(); render();
  });
  return { update: followFish, reset: resetView };
}

function configureLighting({ key, rim, fill }, scene) {
  // Restrained broad illumination keeps the silver flank and dark bars legible.
  key.color.setHex(0xf1f5ff);
  key.position.set(-2.5, 5.8, 3.6);
  key.intensity = 2.0;
  fill.color.setHex(0xe1eaf2);
  fill.position.set(2.8, -.3, 4.8);
  fill.intensity = .65;
  rim.color.setHex(0xf1f5ff);
  rim.intensity = .65;
  scene.environmentIntensity = .85;
}

startFishPreview(cardinalTetra, route, {
  cameraDistance: 18, maxRenderSize: 2000, configureCamera, configureLighting,
  createSubjects: createFish => createFish(route, { count: 10 }),
});
