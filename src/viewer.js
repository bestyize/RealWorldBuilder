import * as THREE from 'three';
import { arowana } from '../fish/arowana/index.js';
import { blueGuppy } from '../fish/blue-guppy/index.js';
import { createGuppySchool } from '../fish/blue-guppy/school.js';
import { soloGuppyRoute } from '../fish/blue-guppy/solo-route.js';
import { loadFish } from '../fish/load-fish.js';
import { installBackgrounds, loadBackground } from './backgrounds.js';
import { cruiseRoute } from './cruise-route.js';
import { installDisplay } from './display.js';
import { takeEmbeddedData, takeSpeciesModel } from './embedded-data.js';
import { createTankEnvironment } from './environment.js';
import { installLighting } from './lighting.js';
import { installSettings } from './settings.js';

const stage = document.querySelector('#tank');
const status = document.querySelector('#status');
const controls = document.querySelector('#controls');
const aquascapeLayer = document.querySelector('#rocky-shallows');
const playbackButton = document.querySelector('#playback');
const fullscreenButton = document.querySelector('#fullscreen');
const overlay = location.hash === '#overlay';
const scenePresets = new Map([
  ['living-room', { background: 'living-room', aquascape: false }],
  ['planted', { background: 'black', aquascape: true }],
]);
const entryScene = scenePresets.get(new URLSearchParams(location.search).get('scene'));
const aspect = 16 / 9;
const cameraDistance = 11;
const viewHeight = 4.5;
const motionTime = { value: 0 };
const floorLight = { value: new THREE.Vector2(0.5, 0.5) };

let aquarium;
let frameRequest = 0;
let hideControlsTimer = 0;
let playing = true;
let suspended = document.hidden;
let playhead = 0;
let clockAnchor = performance.now();
let closeSettings;

window.aquarium = {
  ready: null,
  seek(seconds) {
    if (!Number.isFinite(seconds)) return;
    playhead = seconds;
    clockAnchor = performance.now();
    draw(playhead);
  },
  pause() {
    if (!playing) return;
    playhead = secondsAt(performance.now());
    playing = false;
    cancelAnimationFrame(frameRequest);
    frameRequest = 0;
    syncPlaybackButton();
    draw(playhead);
  },
  play() {
    if (playing) return;
    clockAnchor = performance.now();
    playing = true;
    syncPlaybackButton();
    queueFrame();
  },
  setPresentationMode(enabled = true) {
    document.body.dataset.presentation = String(enabled);
    if (enabled) closeSettings?.();
  },
  get duration() {
    return aquarium?.residents[0]?.duration;
  },
  get currentTime() {
    return secondsAt(performance.now());
  },
};

if (overlay) {
  document.documentElement.dataset.background = 'transparent';
  status.hidden = true;
  window.aquarium.setPresentationMode(true);
}
window.addEventListener('hashchange', () => {
  if ((location.hash === '#overlay') !== overlay) location.reload();
});

window.aquarium.ready = start().catch(error => {
  status.hidden = false;
  status.textContent = '无法打开实时水族箱，请在支持 WebGL 2 的浏览器中打开。';
  throw error;
});
window.aquarium.ready.catch(() => {});

async function start() {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 0.99;
  renderer.domElement.setAttribute('aria-hidden', 'true');
  renderer.domElement.addEventListener('webglcontextlost', () => {
    status.hidden = false;
    status.textContent = '水族箱的图形连接已中断。请重新打开页面。';
    window.aquarium.pause();
  });
  stage.prepend(renderer.domElement);

  const backgrounds = JSON.parse(takeEmbeddedData('#background-presets'));
  const backgroundId = overlay ? 'transparent' : (entryScene?.background ?? backgrounds[0].id);
  const initialBackground = backgrounds.find(background => background.id === backgroundId);
  const [createArowana, createGuppy, backdrop] = await Promise.all([
    loadFish(arowana, takeSpeciesModel(arowana.id)),
    overlay ? null : loadFish(blueGuppy, takeSpeciesModel(blueGuppy.id)),
    loadBackground(initialBackground),
  ]);
  const textureAnisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());

  const scene = new THREE.Scene();
  const cameraFov = THREE.MathUtils.radToDeg(2 * Math.atan(viewHeight / (2 * cameraDistance)));
  const camera = new THREE.PerspectiveCamera(cameraFov, aspect, 0.12, 50);
  const backdropMesh = createBackdrop();
  const bubbles = createBubbles();
  scene.add(backdropMesh, bubbles);
  scene.environment = createTankEnvironment(renderer);

  const dragon = createArowana(cruiseRoute);
  const residents = [dragon];
  let solo;
  let school;
  if (createGuppy) {
    solo = createGuppy(soloGuppyRoute);
    school = createGuppySchool(createGuppy, new THREE.Group());
    residents.push(solo, school);
  }
  for (const { object } of residents) {
    object.traverse(mesh => {
      if (!mesh.isMesh) return;
      mesh.frustumCulled = false;
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const material of materials) addMovingWaterLight(material, textureAnisotropy);
    });
    scene.add(object);
  }
  aquarium = { renderer, scene, camera, residents: [] };
  const redraw = () => {
    if (!playing) draw(playhead);
  };
  installLighting(scene, redraw);

  function applyDisplay({ fish, aquascape }) {
    const mixed = fish === 'mixed';
    dragon.object.visible = mixed || fish === 'arowana';
    if (solo) solo.object.visible = fish === 'guppy';
    if (school) {
      school.object.visible = mixed || fish === 'school';
      // Scale both the shoal and its route to suit the other residents.
      const scale = mixed ? 0.49 : 0.69;
      school.object.scale.setScalar(scale);
      school.object.position.set(0, mixed ? -1.22 : -0.18, mixed ? -0.34 : -0.35);
      // With the foreground enabled, raise the shoal above the sand. In a
      // mixed tank the rock and plants can still briefly hide a passing fish.
      if (aquascape) school.object.position.y += mixed ? 0.28 : 0.36;
    }
    const cameraHeight = mixed ? -0.31 : 0.05;
    const distance = fish === 'guppy' ? 12.0 : cameraDistance;
    camera.position.set(0, cameraHeight, distance);
    camera.lookAt(0, cameraHeight, 0);
    aquascapeLayer.hidden = !aquascape;
    aquarium.residents = residents.filter(fish => fish.object.visible);
    redraw();
  }

  function applyBackground(texture, background) {
    if (texture) {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = textureAnisotropy;
    }
    const uniforms = backdropMesh.material.uniforms;
    uniforms.sceneImage.value?.dispose();
    uniforms.sceneImage.value = texture;
    uniforms.waterEffect.value = background.waterEffect;
    backdropMesh.visible = Boolean(texture);
    bubbles.visible = backdropMesh.visible && background.id !== 'black';
    document.documentElement.dataset.background = background.id;
    redraw();
  }

  applyBackground(backdrop, initialBackground);
  if (overlay) {
    applyDisplay({ fish: 'arowana', aquascape: false });
  } else {
    await installBackgrounds(backgrounds, applyBackground, entryScene ? initialBackground : undefined);
    installDisplay(applyDisplay, entryScene ? { fish: 'mixed', aquascape: entryScene.aquascape } : undefined);
    closeSettings = installSettings();
  }

  clockAnchor = performance.now();
  new ResizeObserver(resize).observe(stage);
  resize();
  status.hidden = true;
  controls.hidden = overlay;
  fullscreenButton.hidden = !document.fullscreenEnabled;
  installControls();
  showControls();
  queueFrame();
  return window.aquarium;
}

function secondsAt(now) {
  return playing && !suspended ? playhead + (now - clockAnchor) / 1000 : playhead;
}

function queueFrame() {
  if (!aquarium || !playing || suspended || frameRequest) return;
  frameRequest = requestAnimationFrame(now => {
    frameRequest = 0;
    draw(secondsAt(now));
    queueFrame();
  });
}

function resize() {
  if (!aquarium || !stage.clientWidth || !stage.clientHeight) return;
  const { renderer } = aquarium;
  const pixelBudget = 3840 * 2160;
  const scale = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(pixelBudget / (stage.clientWidth * stage.clientHeight)));
  renderer.setPixelRatio(scale);
  renderer.setSize(stage.clientWidth, stage.clientHeight, false);
  draw(secondsAt(performance.now()));
}

function draw(time) {
  if (!aquarium) return;
  const { renderer, scene, camera, residents } = aquarium;
  motionTime.value = time;
  for (const fish of residents) fish.update(time);
  const fishPosition = residents[0]?.getMotion?.()?.center;
  if (fishPosition) floorLight.value.set(0.5 + fishPosition.x / 8, 0.5 + fishPosition.z / 6);
  else floorLight.value.set(0.5, 0.5);
  renderer.render(scene, camera);
}

function showControls() {
  clearTimeout(hideControlsTimer);
  controls.dataset.visible = 'true';
  hideControlsTimer = setTimeout(() => {
    if (!controls.matches(':hover')) controls.dataset.visible = 'false';
  }, 2400);
}

function syncPlaybackButton() {
  const label = playing ? '暂停' : '播放';
  playbackButton.dataset.paused = String(!playing);
  playbackButton.setAttribute('aria-label', label);
  playbackButton.title = label + '（空格）';
}

function installControls() {
  const togglePlayback = () => {
    window.aquarium[playing ? 'pause' : 'play']();
    showControls();
  };
  const toggleFullscreen = async () => {
    if (document.fullscreenElement) await document.exitFullscreen();
    else if (document.fullscreenEnabled) await document.documentElement.requestFullscreen();
  };
  const handleFullscreen = () => toggleFullscreen().catch(() => {});
  playbackButton.addEventListener('click', togglePlayback);
  fullscreenButton.addEventListener('click', handleFullscreen);
  stage.addEventListener('pointermove', showControls);
  stage.addEventListener('pointerdown', showControls);
  controls.addEventListener('pointerleave', showControls);
  document.addEventListener('fullscreenchange', () => {
    const active = Boolean(document.fullscreenElement);
    const label = active ? '退出全屏' : '全屏';
    fullscreenButton.dataset.fullscreen = String(active);
    fullscreenButton.setAttribute('aria-label', label);
    fullscreenButton.title = label + '（F）';
  });
  document.addEventListener('keydown', event => {
    if (event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.code === 'Space' && !event.target.closest?.('button, input, select, textarea, [contenteditable]')) {
      event.preventDefault();
      togglePlayback();
    }
    if (event.code === 'KeyF') handleFullscreen();
  });
  document.addEventListener('visibilitychange', () => {
    const now = performance.now();
    playhead = secondsAt(now);
    clockAnchor = now;
    suspended = document.hidden;
    queueFrame();
  });
  syncPlaybackButton();
}

function createBackdrop() {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      sceneImage: { value: null },
      waterEffect: { value: 0 },
      elapsed: motionTime,
      fishCenter: floorLight,
    },
    vertexShader: /* glsl */ `
      varying vec2 imageUv;
      void main() {
        imageUv = uv;
        gl_Position = vec4(position.xy, 0.9999, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D sceneImage;
      uniform float waterEffect;
      uniform float elapsed;
      uniform vec2 fishCenter;
      varying vec2 imageUv;
      void main() {
        vec2 p = imageUv;
        float t = elapsed;
        float surface = smoothstep(0.87, 0.995, p.y) * waterEffect;
        float floorMask = (1.0 - smoothstep(0.04, 0.17, p.y)) * waterEffect;
        float edges = smoothstep(0.0, 0.033, p.x) * (1.0 - smoothstep(0.967, 1.0, p.x));
        float floorWave = (1.0 - smoothstep(0.025, 0.135, p.y)) * edges;
        vec2 displacement = vec2(
          sin(p.y * 39.0 + p.x * 17.0 - t * 0.72) + 0.49 * sin(p.x * 31.0 + p.y * 15.0 + t * 0.51),
          0.52 * sin(p.x * 23.0 + p.y * 31.0 + t * 1.21) + 0.38 * cos(p.x * 11.0 - p.y * 54.0 - t * 0.70)
        );
        vec2 floorFlow = vec2(sin(p.y * 31.0 + p.x * 11.0 + t * 0.73), 0.46 * cos(p.x * 17.0 - p.y * 24.0 + t * 0.83));
        vec2 q = p + displacement * (0.00066 * waterEffect + surface * 0.0034 + floorMask * 0.0042) * edges;
        q += floorFlow * floorWave * 0.0062 * waterEffect;
        vec3 rgb = texture2D(sceneImage, clamp(q, 0.001, 0.999)).rgb;
        float drift = sin(p.x * 23.0 - p.y * 8.0 + t * 0.37) * sin(p.x * 11.0 + p.y * 9.0 - t * 0.51);
        float beam = pow(max(0.0, sin((p.x + p.y * 0.2 + 0.017 * sin(t * 0.23)) * 28.0)), 8.0);
        float wash = smoothstep(0.60, 0.94, p.y) * (1.0 - smoothstep(0.92, 0.99, p.y));
        rgb *= 1.0 - 0.21 * floorMask + 0.086 * floorMask * drift + 0.065 * surface * drift;
        rgb = mix(rgb, vec3(dot(rgb, vec3(0.2126, 0.7152, 0.0722))), 0.085 * floorMask);
        rgb += vec3(0.014, 0.033, 0.049) * wash * beam * 0.26 * waterEffect;
        vec2 softShadow = (p - vec2(fishCenter.x, 0.085 - 0.025 * fishCenter.y)) * vec2(6.2, 25.0);
        rgb *= 1.0 - 0.087 * floorMask * exp(-dot(softShadow, softShadow));
        gl_FragColor = vec4(rgb, 1.0);
        #include <colorspace_fragment>
      }
    `,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  backdrop.frustumCulled = false;
  backdrop.renderOrder = -100;
  return backdrop;
}

function addMovingWaterLight(material, anisotropy) {
  if (!material.isMeshStandardMaterial || material.userData.waterLight) return;
  material.userData.waterLight = true;
  for (const map of [material.map, material.normalMap, material.roughnessMap,
    material.iridescenceMap, material.iridescenceThicknessMap]) {
    if (map) map.anisotropy = anisotropy;
  }
  const previous = material.onBeforeCompile;
  const programKey = material.customProgramCacheKey();
  material.onBeforeCompile = function(shader, renderer) {
    previous.call(this, shader, renderer);
    shader.uniforms.waterTime = motionTime;
    shader.vertexShader = 'varying vec3 waterPosition;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <project_vertex>',
      '#include <project_vertex>\nwaterPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;'
    );
    shader.fragmentShader = 'uniform float waterTime; varying vec3 waterPosition;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', /* glsl */ `
      #include <opaque_fragment>
      vec2 wp = waterPosition.xz;
      wp += 0.17 * vec2(sin(wp.y * 1.9 + waterTime * 0.74), cos(wp.x * 2.3 - waterTime * 0.58));
      float a = sin(wp.x * 6.7 + wp.y * 5.4 + waterTime * 1.3);
      float b = cos(wp.y * 8.3 - wp.x * 4.9 - waterTime * 0.92);
      float lace = pow(1.0 - clamp(abs(a * 0.68 + b * 0.36), 0.0, 1.0), 13.0);
      float surfaceLight = (0.18 + 0.82 * max(0.0, normal.y)) * (0.48 + 0.52 * smoothstep(-0.55, 0.88, waterPosition.y));
      gl_FragColor.rgb *= 1.0 + 0.105 * lace * surfaceLight;
      #if defined( USE_MAP ) && defined( DOUBLE_SIDED )
        // Light through the thinner fin rays in the base-color alpha.
        float translucency = clamp(1.0 - diffuseColor.a, 0.0, 1.0);
        float backlight = pow(1.0 - abs(normal.y), 2.0) * (0.43 + 0.57 * lace);
        gl_FragColor.rgb += diffuseColor.rgb * (0.20 * translucency * backlight);
      #endif
      float saturation = dot(gl_FragColor.rgb, vec3(0.2126, 0.7152, 0.0722));
      gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(saturation), 0.045 + 0.035 * (1.0 - surfaceLight));
      float depth = max(0.0, 0.88 - waterPosition.z);
      vec3 transmittance = exp(-depth * vec3(0.090, 0.056, 0.042));
      gl_FragColor.rgb = gl_FragColor.rgb * transmittance + vec3(0.036, 0.072, 0.120) * (1.0 - transmittance);
    `);
  };
  material.customProgramCacheKey = () => programKey + '|aquarium-water-light-3';
}

function createBubbles() {
  const total = 105;
  const seed = new Float32Array(total * 4);
  const shape = new Float32Array(total * 4);
  let state = 17383;
  const random = () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  for (let i = 0; i < total; i += 1) {
    const k = i * 4;
    const isSuspended = i >= 76;
    const close = i > 68 && !isSuspended;
    const feederX = i < 58 ? -1.22 : i < 68 ? 2.06 : -1.04;
    seed[k] = isSuspended ? random() * 8.0 - 4.0 : feederX + (random() - 0.5) * 0.32;
    seed[k + 1] = isSuspended ? random() * 3.5 - 1.65 : -1.9 - 0.35 * random();
    seed[k + 2] = close ? 1.14 + random() * 0.40 : -1.50 + random() * 0.84;
    seed[k + 3] = random();
    shape[k] = isSuspended ? 0.0035 + random() * 0.008 : 0.009 + Math.pow(random(), 1.8) * (close ? 0.022 : 0.042);
    shape[k + 1] = 0.071 + random() * 0.121;
    shape[k + 2] = random() * Math.PI * 2;
    shape[k + 3] = isSuspended ? 0 : close ? 0.70 : i >= 58 ? 0.48 : 1;
  }
  const plane = new THREE.PlaneGeometry(2, 2);
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.index = plane.index;
  geometry.attributes.position = plane.attributes.position;
  geometry.setAttribute('bubbleSeed', new THREE.InstancedBufferAttribute(seed, 4));
  geometry.setAttribute('bubbleShape', new THREE.InstancedBufferAttribute(shape, 4));
  geometry.instanceCount = total;

  const material = new THREE.ShaderMaterial({
    uniforms: { elapsed: motionTime },
    vertexShader: /* glsl */ `
      uniform float elapsed;
      attribute vec4 bubbleSeed;
      attribute vec4 bubbleShape;
      varying vec2 samplePosition;
      varying float opacity;
      varying float speck;
      varying float variation;
      void main() {
        float t = elapsed;
        float period = bubbleShape.y;
        float phase = bubbleShape.z;
        float travel = fract(bubbleSeed.w + t * period);
        vec3 p = bubbleSeed.xyz;
        float bubble = step(0.01, bubbleShape.w);
        float wobble = sin(t * (1.61 + 4.0 * period) + phase);
        p.x += mix(0.12 * sin(t * 0.17 + phase), (0.035 + travel * 0.16) * wobble + 0.043 * sin(travel * 14.0 + phase), bubble);
        p.y += mix(0.08 * cos(t * 0.18 + phase), 4.38 * travel, bubble);
        p.z += 0.08 * sin(t * 1.45 + phase);
        opacity = mix(0.24 + 0.09 * wobble, bubbleShape.w * smoothstep(0.01, 0.11, travel) * (1.0 - smoothstep(0.88, 0.995, travel)), bubble);
        samplePosition = position.xy;
        variation = bubbleSeed.w;
        speck = 1.0 - bubble;
        float radius = bubbleShape.x * (0.89 + 0.19 * travel);
        vec2 ellipse = vec2(1.04 + 0.095 * wobble, 0.95 - 0.067 * wobble);
        vec4 center = modelViewMatrix * vec4(p, 1.0);
        center.xy += samplePosition * ellipse * radius;
        gl_Position = projectionMatrix * center;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec2 samplePosition;
      varying float opacity;
      varying float speck;
      varying float variation;
      void main() {
        vec2 q = samplePosition;
        float r = length(q);
        float aa = max(0.037, fwidth(r) * 0.75);
        float silhouette = 1.0 - smoothstep(0.90 - aa, 1.0 + aa, r);
        float edge = smoothstep(0.57, 0.99, r);
        vec2 radial = q / max(r, 0.001);
        float hotEdge = 0.31 + 0.69 * pow(max(0.0, dot(radial, normalize(vec2(-0.68, 0.79)))), 2.0);
        float pearl = exp(-24.0 * dot(q - vec2(-0.35, 0.48), q - vec2(-0.35, 0.48)));
        float reflection = exp(-30.0 * dot(q - vec2(0.41, -0.49), q - vec2(0.41, -0.49)));
        float alpha = 0.012 + 0.59 * edge * hotEdge + 0.58 * pearl + 0.17 * reflection;
        vec3 color = mix(vec3(0.17, 0.30, 0.52), vec3(0.67, 0.84, 0.97), hotEdge * edge + 0.27 * pearl);
        color += vec3(0.16, 0.20, 0.23) * pearl;
        color += vec3(0.084, 0.02, 0.113) * reflection * variation;
        gl_FragColor = vec4(color, silhouette * opacity * mix(alpha, 0.39 * (1.0 - r * r), speck));
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  });
  const bubbles = new THREE.Mesh(geometry, material);
  bubbles.frustumCulled = false;
  bubbles.renderOrder = 10;
  return bubbles;
}
