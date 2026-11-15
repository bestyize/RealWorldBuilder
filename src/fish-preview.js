import * as THREE from 'three';
import { loadFish } from '../fish/load-fish.js';
import { takeEmbeddedModel } from './embedded-data.js';
import { createTankEnvironment } from './environment.js';
import { installFullscreen } from './fullscreen.js';
import { addSceneLights } from './lighting.js';
import { fitSwimCamera, swimAspect } from './swim-camera.js';

function installCameraDrag(canvas, rotate) {
  let pointerId;
  let lastX;
  let lastY;

  canvas.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0 || pointerId !== undefined) return;
    pointerId = event.pointerId;
    lastX = event.offsetX;
    lastY = event.offsetY;
    canvas.setPointerCapture(pointerId);
  });
  canvas.addEventListener('pointermove', event => {
    if (event.pointerId !== pointerId) return;
    // Canvas-local coordinates also follow the rotated layout on phones.
    const scale = Math.PI / canvas.clientHeight;
    rotate((event.offsetX - lastX) * scale, (event.offsetY - lastY) * scale);
    lastX = event.offsetX;
    lastY = event.offsetY;
  });
  canvas.addEventListener('lostpointercapture', event => {
    if (event.pointerId === pointerId) pointerId = undefined;
  });
}

export async function startFishPreview(species, route, {
  cameraDistance = 9.4, maxRenderSize = 1600, createSubjects, configureCamera, configureLighting,
} = {}) {
  const stage = document.querySelector('#preview-stage');
  const status = document.querySelector('#preview-status');
  const resetView = document.querySelector('#preview-reset-view');
  const playButton = document.querySelector('#preview-play');
  const scrubber = document.querySelector('#preview-time');
  const timeLabel = document.querySelector('#preview-time-label');

  try {
    const createFish = await loadFish(species, takeEmbeddedModel());
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    const canvas = renderer.domElement;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.toneMappingExposure = .99;
    canvas.tabIndex = 0;
    canvas.setAttribute('aria-label', '观察角度，使用方向键旋转');

    const scene = new THREE.Scene();
    scene.environment = createTankEnvironment(renderer);
    const lights = addSceneLights(scene);
    configureLighting?.(lights, scene);

    const fish = createSubjects ? createSubjects(createFish) : createFish(route);
    fish.object.traverse(mesh => {
      if (mesh.isSkinnedMesh) mesh.frustumCulled = false;
    });
    scene.add(fish.object);

    const cameraFov = 25;
    const camera = new THREE.PerspectiveCamera(cameraFov, swimAspect, .12, 50);
    const target = new THREE.Vector3(0, .12, 0);
    const front = Math.PI / 2;
    const orbit = new THREE.Spherical(cameraDistance, front, 0);

    const duration = fish.duration;
    let time = 0;
    let playing = true;
    let anchor = performance.now();
    let frame = 0;
    let contextLost = false;
    scrubber.max = String(duration);

    const render = () => {
      if (!contextLost) renderer.render(scene, camera);
    };

    function updateView() {
      camera.position.setFromSpherical(orbit).add(target);
      camera.lookAt(target);
      if (!playing) render();
    }

    updateView();
    stage.prepend(canvas);
    const cameraControls = configureCamera?.(camera, canvas, fish, render);

    function rotate(horizontal, vertical) {
      orbit.theta -= horizontal;
      orbit.phi = THREE.MathUtils.clamp(orbit.phi - vertical, front - .6, front + .6);
      updateView();
    }

    function draw() {
      fish.update(time);
      cameraControls?.update();
      render();
      scrubber.value = String(time);
      timeLabel.value = `${time.toFixed(1)} / ${duration.toFixed(1)} 秒`;
    }

    function advance(now) {
      time = (time + (now - anchor) / 1000) % duration;
      anchor = now;
    }

    function queueFrame() {
      if (!playing || document.hidden || frame) return;
      frame = requestAnimationFrame(now => {
        frame = 0;
        advance(now);
        draw();
        queueFrame();
      });
    }

    function setPlaying(next, seekTime) {
      const now = performance.now();
      if (seekTime !== undefined) time = seekTime;
      else if (playing && !document.hidden) advance(now);
      playing = next;
      anchor = now;
      playButton.textContent = playing ? '暂停' : '播放';
      cancelAnimationFrame(frame);
      frame = 0;
      draw();
      queueFrame();
    }

    const resize = () => {
      const { clientWidth: width, clientHeight: height } = stage;
      if (contextLost || !width || !height) return;
      fitSwimCamera(camera, width, height, cameraFov);
      renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2, maxRenderSize / Math.max(width, height)));
      renderer.setSize(width, height, false);
      draw();
    };

    playButton.addEventListener('click', () => setPlaying(!playing));
    scrubber.addEventListener('input', () => setPlaying(false, scrubber.valueAsNumber));
    const resetOrbit = () => {
      orbit.set(cameraDistance, front, 0);
      updateView();
    };
    resetView.addEventListener('click', cameraControls?.reset ?? resetOrbit);
    if (!cameraControls) {
      installCameraDrag(canvas, rotate);
      const keyRotation = new Map([
        ['ArrowLeft', [-.12, 0]], ['ArrowRight', [.12, 0]],
        ['ArrowUp', [0, -.12]], ['ArrowDown', [0, .12]],
      ]);
      canvas.addEventListener('keydown', event => {
        const step = keyRotation.get(event.key);
        if (!step || event.altKey || event.ctrlKey || event.metaKey) return;
        event.preventDefault();
        rotate(...step);
      });
    }
    document.addEventListener('visibilitychange', () => {
      cancelAnimationFrame(frame);
      frame = 0;
      anchor = performance.now();
      queueFrame();
    });
    canvas.addEventListener('webglcontextlost', () => {
      contextLost = true;
      playing = false;
      cancelAnimationFrame(frame);
      frame = 0;
      canvas.tabIndex = -1;
      resetView.disabled = playButton.disabled = scrubber.disabled = true;
      status.hidden = false;
      status.textContent = '图形连接已中断，请重新打开页面。';
    });

    new ResizeObserver(resize).observe(stage);
    resize();
    status.hidden = true;
    resetView.disabled = playButton.disabled = scrubber.disabled = false;
    installFullscreen(document.querySelector('#preview-fullscreen'), { landscape: true });
    queueFrame();
  } catch (error) {
    status.textContent = '无法打开预览，请使用支持 WebGL 2 的浏览器。';
    console.error(error);
  }
}
