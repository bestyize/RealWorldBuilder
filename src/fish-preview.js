import * as THREE from 'three';
import { loadFish } from '../fish/load-fish.js';
import { takeEmbeddedModel } from './embedded-data.js';
import { createTankEnvironment } from './environment.js';
import { addSceneLights } from './lighting.js';

export async function startFishPreview(species, route, { cameraDistance = 9.4, createSubjects } = {}) {
  const stage = document.querySelector('#preview-stage');
  const status = document.querySelector('#preview-status');
  const playButton = document.querySelector('#preview-play');
  const scrubber = document.querySelector('#preview-time');
  const timeLabel = document.querySelector('#preview-time-label');

  try {
    const createFish = await loadFish(species, takeEmbeddedModel());
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.toneMappingExposure = .99;
    renderer.domElement.setAttribute('aria-hidden', 'true');

    const scene = new THREE.Scene();
    scene.environment = createTankEnvironment(renderer);
    addSceneLights(scene);

    const fish = createSubjects ? createSubjects(createFish) : createFish(route);
    fish.object.traverse(mesh => {
      if (mesh.isSkinnedMesh) mesh.frustumCulled = false;
    });
    scene.add(fish.object);

    const camera = new THREE.PerspectiveCamera(25, 16 / 9, .12, 50);
    camera.position.set(0, .12, cameraDistance);
    camera.lookAt(0, .12, 0);

    const duration = fish.duration;
    let time = 0;
    let playing = true;
    let anchor = performance.now();
    let frame = 0;
    scrubber.max = String(duration);

    function draw() {
      fish.update(time);
      renderer.render(scene, camera);
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
      if (!stage.clientWidth || !stage.clientHeight) return;
      camera.aspect = stage.clientWidth / stage.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2, 1600 / stage.clientWidth));
      renderer.setSize(stage.clientWidth, stage.clientHeight, false);
      draw();
    };

    playButton.addEventListener('click', () => setPlaying(!playing));
    scrubber.addEventListener('input', () => setPlaying(false, scrubber.valueAsNumber));
    document.addEventListener('visibilitychange', () => {
      cancelAnimationFrame(frame);
      frame = 0;
      anchor = performance.now();
      queueFrame();
    });
    renderer.domElement.addEventListener('webglcontextlost', () => {
      playing = false;
      cancelAnimationFrame(frame);
      frame = 0;
      playButton.disabled = scrubber.disabled = true;
      status.hidden = false;
      status.textContent = '图形连接已中断，请重新打开页面。';
    });

    stage.prepend(renderer.domElement);
    new ResizeObserver(resize).observe(stage);
    resize();
    status.hidden = true;
    playButton.disabled = scrubber.disabled = false;
    queueFrame();
  } catch (error) {
    status.textContent = '无法打开预览，请使用支持 WebGL 2 的浏览器。';
    console.error(error);
  }
}
