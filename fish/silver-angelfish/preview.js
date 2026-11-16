import { Vector3 } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { startFishPreview } from '../../src/fish-preview.js';
import { createSwimRoute } from '../swim-route.js';
import { silverAngelfish } from './index.js';

// A compact route with slow hovering intervals, not a tank-length cruise.
const route = createSwimRoute([
  [0, 0, .65], [1.1, .04, .65], [1.65, .08, .25],
  [1.55, .12, -.40], [.6, .10, -.65], [-.6, .04, -.65],
  [-1.55, -.03, -.40], [-1.65, -.04, .25], [-1.1, -.02, .65],
]);

function configureCamera(camera, canvas, fish, render) {
  const controls = new OrbitControls(camera, canvas);
  controls.enablePan = false;
  controls.minDistance = 7.5;
  controls.maxDistance = 28;
  controls.minPolarAngle = .36;
  controls.maxPolarAngle = Math.PI - .36;
  controls.rotateSpeed = .76;
  const center = new Vector3();
  const offset = new Vector3();
  const initialOffset = camera.position.clone().sub(controls.target);

  function followFish() {
    center.copy(fish.getMotion().center);
    center.y -= .405;
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
  return { update: followFish, reset: resetView };
}

function configureLighting({ key, rim, fill }, scene) {
  // Restrained broad illumination keeps the silver flank and dark bars legible.
  key.color.setHex(0xf1f5ff);
  key.position.set(-2.5, 5.8, 3.6);
  key.intensity = 1.7;
  fill.color.setHex(0xe1eaf2);
  fill.position.set(2.8, -.3, 4.8);
  fill.intensity = .30;
  rim.color.setHex(0xf1f5ff);
  rim.intensity = .65;
  scene.environmentIntensity = .65;
}

startFishPreview(silverAngelfish, route, {
  cameraDistance: matchMedia('(pointer: coarse)').matches ? 20.5 : 17.5, maxRenderSize: 2400, configureCamera, configureLighting,
});
