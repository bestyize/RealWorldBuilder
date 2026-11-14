import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { takeEmbeddedModel } from '../../src/embedded-data.js';
import { createContactShadow, createLinenFloor, createStudioEnvironment, STUDIO_WINDOW_POSITION } from './studio.js';
import { addPlushVolume } from './plush-volume.js';

const stage = document.querySelector('#stage');
const status = document.querySelector('#status');
const angles = [...document.querySelectorAll('[data-angle]')];
const rotate = document.querySelector('#rotate');
const reset = document.querySelector('#reset');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

async function openModel() {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.autoUpdate = false;
  renderer.domElement.tabIndex = 0;
  renderer.domElement.setAttribute('aria-label', '碎花垂耳兔三维模型。方向键旋转，加减键缩放，Home 键复位。');
  stage.prepend(renderer.domElement);

  const decoder = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const { scene: model } = await decoder.parseAsync(takeEmbeddedModel(), '');
  model.scale.setScalar(10);
  model.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(model, true);
  const subject = bounds.getCenter(new THREE.Vector3());
  model.position.set(-subject.x, -bounds.min.y, -subject.z * .36);
  model.updateMatrixWorld(true);
  const centerZ = subject.z + model.position.z;
  const anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
  model.traverse(object => {
    if (!object.isMesh) return;
    const looseFiber = object.parent.name.startsWith('Groom') || object.name.startsWith('Groom');
    object.castShadow = !looseFiber;
    object.receiveShadow = true;
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      for (const texture of [material.map, material.roughnessMap, material.normalMap]) {
        if (texture) texture.anisotropy = anisotropy;
      }
    }
  });

  const scene = new THREE.Scene();
  scene.environment = createStudioEnvironment(renderer).texture;
  scene.environmentIntensity = .84;
  scene.add(new THREE.HemisphereLight(0xfff6ed, 0xe0c3aa, .46));
  const key = new THREE.DirectionalLight(0xffe8d6, 1.36);
  key.position.set(...STUDIO_WINDOW_POSITION);
  key.position.y += 1.30;
  key.target.position.set(0, 1.30, 0);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -2.1, right: 2.1, bottom: -2.1, top: 2.1, near: 2, far: 9.5 });
  key.shadow.camera.updateProjectionMatrix();
  key.shadow.intensity = .56;
  key.shadow.normalBias = .014;
  key.shadow.bias = -.0003;
  key.shadow.radius = 11;
  scene.add(key, key.target);
  const fill = new THREE.DirectionalLight(0xfff4e9, .72);
  fill.position.set(3.25, 1.8, 4.85);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffedde, .48);
  rim.position.set(1.5, 3.85, -4.5);
  scene.add(rim);
  scene.add(createLinenFloor(anisotropy), createContactShadow(renderer, model, centerZ), model);
  const updateNap = addPlushVolume(model, anisotropy, STUDIO_WINDOW_POSITION);

  const camera = new THREE.PerspectiveCamera(27, 1, .04, 45);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = .10;
  controls.enablePan = false;
  controls.zoomToCursor = true;
  controls.rotateSpeed = .74;
  controls.zoomSpeed = .76;
  controls.autoRotateSpeed = 1.20;
  controls.minPolarAngle = .45;
  controls.maxPolarAngle = Math.PI / 2 + .045;
  controls.minDistance = 2.85;
  controls.maxDistance = 17;
  controls.touches.ONE = THREE.TOUCH.ROTATE;
  controls.touches.TWO = THREE.TOUCH.DOLLY_PAN;

  const target = new THREE.Vector3(0, 1.404, centerZ * .50);
  const materialFocus = new THREE.Vector3(.07, 2.21, .36);
  const materialButton = angles.find(button => button.hasAttribute('data-material-view'));
  const view = new THREE.Spherical();
  let frame = 0;
  let transition;
  let needsRender = true;
  let contextLost = false;

  function baseRadius() {
    return Math.max(8.12, 7.04 / Math.min(camera.aspect, 1));
  }

  function setRotation(enabled) {
    controls.autoRotate = enabled;
    rotate.setAttribute('aria-pressed', String(enabled));
    queueFrame();
  }

  function highlight(active) {
    for (const button of angles) button.setAttribute('aria-pressed', String(button === active));
  }

  function queueFrame() {
    if (!frame && !document.hidden && !contextLost) {
      frame = requestAnimationFrame(draw);
    }
  }

  function draw(now) {
    frame = 0;
    if (transition) {
      const { start, end, startTarget, endTarget, time } = transition;
      const t = Math.min(1, (now - time) / 560);
      const ease = t * t * (3 - 2 * t);
      view.radius = THREE.MathUtils.lerp(start.radius, end.radius, ease);
      view.theta = THREE.MathUtils.lerp(start.theta, end.theta, ease);
      view.phi = THREE.MathUtils.lerp(start.phi, end.phi, ease);
      controls.target.lerpVectors(startTarget, endTarget, ease);
      camera.position.setFromSpherical(view).add(controls.target);
      if (t === 1) transition = undefined;
    }
    const changed = controls.update();
    if (needsRender || changed) {
      updateNap(camera);
      renderer.render(scene, camera);
      needsRender = false;
    }
    if (transition || controls.autoRotate || changed) queueFrame();
  }

  function moveTo(theta, height, radius = baseRadius(), animate = true, focus = target) {
    const end = new THREE.Spherical(radius, Math.PI / 2 - height, theta);
    if (!animate || reduceMotion.matches) {
      transition = undefined;
      controls.target.copy(focus);
      camera.position.setFromSpherical(end).add(focus);
      controls.update();
      needsRender = true;
    } else {
      const startTarget = controls.target.clone();
      const endTarget = focus.clone();
      const start = new THREE.Spherical().setFromVector3(camera.position.clone().sub(startTarget));
      end.theta = start.theta + Math.atan2(Math.sin(end.theta - start.theta), Math.cos(end.theta - start.theta));
      transition = { start, end, startTarget, endTarget, time: performance.now() };
    }
    queueFrame();
  }

  function chooseAngle(button, animate = true) {
    setRotation(false);
    highlight(button);
    const theta = THREE.MathUtils.degToRad(Number(button.dataset.angle));
    if (button === materialButton) {
      moveTo(theta, .10, Math.max(controls.minDistance, 3.49 / Math.min(camera.aspect, 1)), animate, materialFocus);
    } else {
      moveTo(theta, .170, undefined, animate);
    }
  }

  function resize() {
    const { width, height } = stage.getBoundingClientRect();
    if (width < 1 || height < 1) return;
    const before = baseRadius();
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2, 1850 / Math.max(width, height)));
    renderer.setSize(width, height, false);
    if (camera.position.lengthSq()) {
      const r = baseRadius() / before;
      camera.position.sub(controls.target).multiplyScalar(r).add(controls.target);
      if (transition) {
        transition.start.radius *= r;
        transition.end.radius *= r;
      }
    }
    needsRender = true;
    queueFrame();
  }

  for (const button of angles) button.addEventListener('click', () => chooseAngle(button));
  reset.addEventListener('click', () => chooseAngle(angles[0]));
  renderer.domElement.addEventListener('dblclick', () => chooseAngle(angles[0]));
  rotate.addEventListener('click', () => {
    const enabled = !controls.autoRotate;
    transition = undefined;
    if (enabled) highlight(null);
    setRotation(enabled);
  });
  controls.addEventListener('start', () => {
    transition = undefined;
    setRotation(false);
    highlight(null);
  });
  controls.addEventListener('change', () => {
    needsRender = true;
    queueFrame();
  });
  renderer.domElement.addEventListener('keydown', event => {
    const pose = new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
    const height = Math.PI / 2 - pose.phi;
    let { theta, radius } = pose;
    let pitch = height;
    switch (event.key) {
      case 'ArrowLeft': theta -= .27; break;
      case 'ArrowRight': theta += .27; break;
      case 'ArrowUp': pitch += .17; break;
      case 'ArrowDown': pitch -= .17; break;
      case '+': case '=': radius *= .78; break;
      case '-': radius /= .78; break;
      case 'Home':
        event.preventDefault();
        chooseAngle(angles[0]);
        return;
      default: return;
    }
    event.preventDefault();
    setRotation(false);
    highlight(null);
    moveTo(theta, THREE.MathUtils.clamp(pitch, -.045, Math.PI / 2 - .45),
      THREE.MathUtils.clamp(radius, controls.minDistance, controls.maxDistance), true, controls.target);
  });

  renderer.domElement.addEventListener('webglcontextlost', () => {
    contextLost = true;
    cancelAnimationFrame(frame);
    frame = 0;
    controls.enabled = false;
    for (const button of [...angles, rotate, reset]) button.disabled = true;
    status.hidden = false;
    status.textContent = '图形连接已中断，请刷新页面。';
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      cancelAnimationFrame(frame);
      frame = 0;
    } else {
      queueFrame();
    }
  });

  controls.target.copy(target);
  resize();
  chooseAngle(angles[0], false);
  new ResizeObserver(resize).observe(stage);
  renderer.shadowMap.needsUpdate = true;
  updateNap(camera);
  renderer.render(scene, camera);
  stage.dataset.ready = 'true';
  for (const button of [...angles, rotate, reset]) button.disabled = false;
  status.hidden = true;
}

status.hidden = false;
openModel().catch(error => {
  status.textContent = '无法载入三维模型，请用支持 WebGL 2 的浏览器打开。';
  console.error(error);
});
