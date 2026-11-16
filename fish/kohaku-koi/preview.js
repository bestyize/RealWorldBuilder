import { Vector3 } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { startFishPreview } from '../../src/fish-preview.js';
import { createSwimRoute } from '../swim-route.js';
import { kohakuKoi } from './index.js';
import { kohakuCruisePoints } from './route.js';

const route = createSwimRoute(kohakuCruisePoints);

function configureCamera(camera, canvas, fish, render) {
  const controls = new OrbitControls(camera, canvas);
  controls.enablePan = false;
  controls.minDistance = 8;
  controls.maxDistance = 23;
  controls.minPolarAngle = .36;
  controls.maxPolarAngle = Math.PI - .36;
  controls.rotateSpeed = .76;
  const center = new Vector3();
  const offset = new Vector3();
  const initialOffset = camera.position.clone().sub(controls.target);

  function followFish() {
    center.copy(fish.getMotion().center);
    center.y -= .11;
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
  // Soft, neutral reflected light keeps the underside readable during a turn.
  key.color.setHex(0xfff7ee);
  key.position.set(-2.5, 5.8, 3.6);
  key.intensity = 1.6;
  fill.color.setHex(0xf2f7ff);
  fill.position.set(2.8, -1.35, 4.8);
  fill.intensity = .55;
  rim.color.setHex(0xf3ecdf);
  rim.intensity = .85;
  scene.environmentIntensity = .72;
}

startFishPreview(kohakuKoi, route, {
  cameraDistance: 14.0, maxRenderSize: 2400, configureCamera, configureLighting,
});
