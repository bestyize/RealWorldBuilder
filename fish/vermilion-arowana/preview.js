import { HemisphereLight, MathUtils, Vector3 } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { startFishPreview } from '../../src/fish-preview.js';
import { createVermilionPreviewRoute } from '../arowana/cruise-route.js';
import { vermilionArowana } from './index.js';

const route = createVermilionPreviewRoute();
const FOCUS_HEIGHT = .12;

function configureCamera(camera, canvas, fish, render) {
  const controls = new OrbitControls(camera, canvas);
  controls.enablePan = false;
  controls.minDistance = 2.55;
  controls.maxDistance = 10;
  controls.minPolarAngle = .36;
  controls.maxPolarAngle = Math.PI - .36;
  controls.rotateSpeed = .76;
  const center = new Vector3();
  const offset = new Vector3();
  const initialOffset = camera.position.clone().sub(controls.target);

  function followFish() {
    center.copy(fish.getMotion().center);
    // Keep the fish in view while retaining most of its rise and fall.
    center.y = MathUtils.lerp(FOCUS_HEIGHT, center.y, .30) - .11;
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
  key.position.set(-1.9, 3.4, 4.8);
  key.intensity = 2.0;
  fill.position.set(1.2, -1.8, 4.8);
  fill.intensity = 1.17;
  rim.intensity = 1.27;
  scene.environmentIntensity = 1.38;
  scene.add(new HemisphereLight(0xf2f7ff, 0xd3dfea, .55));
}

startFishPreview(vermilionArowana, route, {
  cameraDistance: 5.95, maxRenderSize: 2400, configureCamera, configureLighting,
});
