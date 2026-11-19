import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { takeEmbeddedModel } from '../../src/embedded-data.js';
import { createRoom, floorLimits, stations } from './room.js';
import { installEyelids } from './eyelids.js';
import { keepsakeReader } from './keepsakes.js';

const canvas = document.querySelector('#world');
const status = document.querySelector('#status');
const readingButton = document.querySelector('#reading');
const writingButton = document.querySelector('#writing');
const shelfButton = document.querySelector('#shelf');
const viewButtons = document.querySelectorAll('[data-camera]');
const about = document.querySelector('#about');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
document.querySelector('#credits').addEventListener('click', () => about.showModal());

function lightRoom(scene) {
  scene.add(new THREE.HemisphereLight(0xcad9ff, 0xb6a6b1, 0.96));
  const moon = new THREE.DirectionalLight(0xb9ceff, 1.05);
  moon.position.set(-3.9, 7.4, -2.5);
  moon.target.position.set(0, 0, 1.3);
  moon.castShadow = true;
  moon.shadow.mapSize.set(2048, 2048);
  Object.assign(moon.shadow.camera, { left: -8.2, right: 8.2, bottom: -8, top: 8, near: 0.25, far: 24 });
  moon.shadow.normalBias = 0.018;
  moon.shadow.bias = -0.00022;
  moon.shadow.radius = 2.8;
  scene.add(moon, moon.target);
  const fill = new THREE.DirectionalLight(0xffe4d7, 0.68);
  fill.position.set(2.8, 3.8, 5.7);
  scene.add(fill);
}

function roomCamera(canvas, renderer, actor) {
  const camera = new THREE.PerspectiveCamera(40, 1, 0.055, 58);
  const controls = new OrbitControls(camera, canvas);
  controls.enablePan = false;
  controls.enableDamping = !reducedMotion;
  controls.dampingFactor = 0.13;
  controls.rotateSpeed = 0.43;
  controls.zoomSpeed = 0.75;
  const focus = new THREE.Vector3(),
    shift = new THREE.Vector3();
  const wideFocus = new THREE.Vector3(-0.2, 1.16, -0.55);
  const framing = {
    wide: { distance: 12.85, angle: 0.065, tilt: 0.265, min: 10.0, max: 14.2 },
    follow: { distance: 4.65, angle: -0.47, tilt: 0.34, min: 3.15, max: 6.8 },
  };
  let mode;

  function focusPoint() {
    if (mode === 'wide') {
      const pan = (1 - THREE.MathUtils.smoothstep(camera.aspect, 0.48, 1.12)) * 0.48;
      focus.copy(wideFocus);
      focus.x += pan * (actor.position.x - wideFocus.x);
      return focus;
    }
    return focus.set(actor.position.x, 0.95 + actor.position.y * 0.4, actor.position.z - 0.12);
  }
  function fit() {
    const w = canvas.clientWidth,
      h = Math.max(1, canvas.clientHeight);
    camera.aspect = w / h;
    // Preserve the horizontal field in the overview and enough space around the character on a phone.
    const gate = mode === 'wide' ? 1.4 : 0.6;
    camera.fov = THREE.MathUtils.radToDeg(
      2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(20)) * Math.max(1, gate / camera.aspect))
    );
    camera.fov = Math.min(80, camera.fov);
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }
  function steer(dt, snap = false) {
    shift
      .copy(focusPoint())
      .sub(controls.target)
      .multiplyScalar(snap || reducedMotion ? 1 : 1 - Math.exp(-6 * dt));
    controls.target.add(shift);
    camera.position.add(shift);
    // Keep the eye on the room side of the wall when following the character into either aisle.
    const radius = Math.max(1, camera.position.distanceTo(controls.target)),
      angle = mode === 'wide' ? 0.2 : 0.82;
    controls.minPolarAngle = Math.max(
      mode === 'wide' ? 1.28 : 0.94,
      Math.acos(THREE.MathUtils.clamp((4.76 - controls.target.y) / radius, -1, 1))
    );
    controls.minAzimuthAngle = Math.max(
      -angle,
      Math.asin(THREE.MathUtils.clamp((-5.83 - controls.target.x) / radius, -1, 1))
    );
    controls.maxAzimuthAngle = Math.min(
      angle,
      Math.asin(THREE.MathUtils.clamp((5.83 - controls.target.x) / radius, -1, 1))
    );
    controls.update(dt);
  }
  function select(next) {
    mode = next;
    canvas.dataset.view = mode;
    viewButtons.forEach((button) =>
      button.setAttribute('aria-pressed', String(button.dataset.camera === mode))
    );
    const f = framing[mode];
    const portrait = canvas.clientWidth / canvas.clientHeight < 0.78;
    const distance = mode === 'follow' && portrait ? 5.85 : f.distance;
    const tilt = mode === 'wide' && portrait ? 0.18 : f.tilt;
    const horizontal = distance * Math.cos(tilt);
    controls.minDistance = f.min;
    controls.maxDistance = f.max;
    controls.minPolarAngle = mode === 'wide' ? 1.28 : 1.02;
    controls.maxPolarAngle = mode === 'wide' ? 1.39 : 1.47;
    controls.target.copy(focusPoint());
    camera.position
      .set(horizontal * Math.sin(f.angle), distance * Math.sin(tilt), horizontal * Math.cos(f.angle))
      .add(controls.target);
    fit();
    steer(0, true);
  }
  function choose(next) {
    if (mode !== next) select(next);
  }
  select(canvas.clientWidth / canvas.clientHeight < 0.78 ? 'follow' : 'wide');
  window.addEventListener('resize', fit);
  viewButtons.forEach((button) => button.addEventListener('click', () => choose(button.dataset.camera)));
  return { camera, controls, steer, toggle: () => choose(mode === 'wide' ? 'follow' : 'wide') };
}

const directions = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
const messages = {
  idle: '鲸鱼娘在书房里歇脚',
  walking: '正在散步',
  approach: '正走向窗边的长椅',
  deskApproach: '正走向写字桌',
  sit: '坐下，翻开书',
  reading: '正在窗边读书',
  writing: '正在书桌前写信',
  rise: '合上书，起身',
  shelfApproach: '正走向书架旁的梯子',
  climb: '正踩着木梯找书',
  drawBook: '正在抽出夹着书签的书',
  found: '书页里夹着一样东西',
  descend: '正从梯子上下来',
};

async function enterRoom() {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.65));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#a2aec7');
  lightRoom(scene);
  const actor = new THREE.Group();
  actor.scale.setScalar(0.84);
  actor.rotation.y = 0.17;
  const ground = new THREE.Vector2(-0.65, 1.5),
    target = ground.clone();
  actor.position.set(ground.x, 0.008, ground.y);
  scene.add(actor);
  const view = roomCamera(canvas, renderer, actor);
  const character = new GLTFLoader().parseAsync(takeEmbeddedModel(), '');
  const environment = createRoom(scene).then((room) => {
    room.shadow.visible = false;
    renderer.render(scene, view.camera);
    return room;
  });
  const [gltf, { shadow, chime, shelfBooks }] = await Promise.all([character, environment]);
  shadow.visible = true;
  actor.add(gltf.scene);
  const mixer = new THREE.AnimationMixer(gltf.scene);
  const parts = [];
  gltf.scene.traverse((part) => parts.push(part));
  const clips = ['idle', 'walk', 'read', stations.seat.clip, stations.desk.clip].map((name) => {
    const clip = THREE.AnimationClip.findByName(gltf.animations, name);
    if (!clip) throw new Error('模型缺少动作 ' + name);
    return clip;
  });
  const updateBlink = installEyelids(gltf.scene, clips);
  const actions = new Map(clips.map((clip) => [clip.name, mixer.clipAction(clip)]));
  const pencil = gltf.scene.getObjectByName('Pencil');
  const nib = gltf.scene.getObjectByName('Graphite').position.clone().normalize();
  const paperPoint = new THREE.Vector3();
  let action;
  function play(name) {
    const next = actions.get(name);
    if (next === action) return;
    next.reset().setEffectiveWeight(1).play();
    if (action) action.crossFadeTo(next, 0.22, false);
    action = next;
  }
  const pin = new THREE.Mesh(
    new THREE.RingGeometry(0.105, 0.127, 40),
    new THREE.MeshBasicMaterial({ color: 0xffedb4, transparent: true, depthWrite: false })
  );
  pin.rotation.x = -Math.PI / 2;
  pin.visible = false;
  pin.renderOrder = 3;
  scene.add(pin);
  let destination = null,
    occupied = null,
    settled = 0,
    pinAge = 1;
  const held = new Set(),
    delta = new THREE.Vector2(),
    direction = new THREE.Vector2();
  let chosenBook = 0,
    activeBook = 0,
    nextBook = 0,
    pulled = 0,
    revealed = false;
  const shelfOrigins = shelfBooks.map((book) => book.position.clone());
  const reader = keepsakeReader(() => {
    moveTo(-4.36, -1.48);
    shelfButton.focus({ preventScroll: true });
  });
  function chooseBook(index) {
    chosenBook = index;
    visit('shelf');
  }
  shelfButton.disabled = false;
  shelfButton.addEventListener('click', () => chooseBook(nextBook));
  function state(name) {
    if (status.dataset.state === name) return;
    status.dataset.state = name;
    status.textContent = messages[name];
  }
  function moveTo(x, z, station = null, showPin = true) {
    destination = station;
    target.set(
      THREE.MathUtils.clamp(x, floorLimits.left, floorLimits.right),
      THREE.MathUtils.clamp(z, floorLimits.back, floorLimits.front)
    );
    readingButton.textContent = station === 'seat' ? '离开长椅' : '窗边读书';
    writingButton.textContent = station === 'desk' ? '离开书桌' : '书桌写信';
    if (showPin) {
      pin.position.set(target.x, 0.029, target.y);
      pinAge = 0;
    }
  }
  function visit(name) {
    held.clear();
    moveTo(...stations[name].approach, name);
  }
  function toggleStation(name) {
    if (destination === name) {
      held.clear();
      moveTo(name === 'seat' ? -0.28 : 2.92, name === 'seat' ? -2.18 : 1.03);
    } else visit(name);
  }
  for (const [name, button] of [
    ['seat', readingButton],
    ['desk', writingButton],
  ]) {
    button.disabled = false;
    button.addEventListener('click', () => toggleStation(name));
  }
  function keyboardStep() {
    direction.set(0, 0);
    for (const key of held) {
      direction.x += directions[key][0];
      direction.y += directions[key][1];
    }
    if (direction.lengthSq() === 0) return;
    direction.normalize();
    const a = view.controls.getAzimuthalAngle(),
      c = Math.cos(a),
      s = Math.sin(a);
    moveTo(
      ground.x + 0.3 * (direction.x * c + direction.y * s),
      ground.y + 0.3 * (direction.y * c - direction.x * s),
      null,
      false
    );
  }
  function turn(angle, dt) {
    const d = angle - actor.rotation.y;
    actor.rotation.y += Math.atan2(Math.sin(d), Math.cos(d)) * (1 - Math.exp(-11 * dt));
  }
  function update(dt) {
    if (held.size) keyboardStep();
    delta.subVectors(target, ground);
    const d = delta.length();
    if (occupied && (occupied !== destination || (occupied === 'shelf' && activeBook !== chosenBook))) {
      const onLadder = occupied === 'shelf';
      if (onLadder && pulled > 0) pulled = Math.max(0, pulled - dt / 0.42);
      else settled = Math.max(0, settled - dt / (onLadder ? 1.05 : 0.36));
      play(onLadder && pulled === 0 ? 'walk' : 'idle');
      state(onLadder ? 'descend' : occupied === 'seat' ? 'rise' : 'idle');
      if (!settled) {
        occupied = null;
        revealed = false;
      }
    } else if (d > 0.006) {
      play('walk');
      state(
        destination === 'shelf'
          ? 'shelfApproach'
          : destination === 'seat'
            ? 'approach'
            : destination === 'desk'
              ? 'deskApproach'
              : 'walking'
      );
      turn(Math.atan2(delta.x, delta.y), dt);
      ground.addScaledVector(delta, Math.min(d, 1.65 * dt) / d);
    } else if (destination === 'shelf') {
      occupied = 'shelf';
      activeBook = chosenBook;
      turn(stations.shelf.yaw, dt);
      settled = Math.min(1, settled + dt / (1.05 + activeBook * 0.28));
      if (settled < 1) {
        play('walk');
        state('climb');
      } else {
        play('read');
        state(pulled < 1 ? 'drawBook' : 'found');
        pulled = Math.min(1, pulled + dt / 0.85);
        if (pulled === 1 && !revealed && !about.open) {
          revealed = true;
          nextBook = (activeBook + 1) % reader.count;
          reader.show(activeBook);
        }
      }
    } else if (destination) {
      ground.copy(target);
      occupied = destination;
      const s = stations[occupied];
      settled = Math.min(1, settled + dt / 0.5);
      turn(s.yaw, dt);
      play(s.clip);
      state(occupied === 'desk' ? 'writing' : settled < 1 ? 'sit' : 'reading');
    } else {
      play('idle');
      state('idle');
    }
    actor.position.set(ground.x, 0.008, ground.y);
    if (occupied === 'shelf') {
      const t = THREE.MathUtils.smoothstep(settled, 0, 1);
      const height = shelfOrigins[activeBook].y - 0.62;
      actor.position.x -= t * (0.2 + height * 0.18);
      actor.position.y += t * height;
    } else if (occupied) {
      const t = THREE.MathUtils.smoothstep(settled, 0, 1),
        p = stations[occupied].pose;
      actor.position.set(
        THREE.MathUtils.lerp(ground.x, p[0], t),
        THREE.MathUtils.lerp(0.008, p[1], t),
        THREE.MathUtils.lerp(ground.y, p[2], t)
      );
    }
    for (let i = 0; i < shelfBooks.length; i++) {
      const reach = i === activeBook ? THREE.MathUtils.smoothstep(pulled, 0, 1) : 0;
      shelfBooks[i].position.x = shelfOrigins[i].x + 0.35 * reach;
      shelfBooks[i].rotation.z = -0.18 * reach;
    }
    shadow.position.set(actor.position.x, 0.025, actor.position.z + 0.01);
    shadow.material.opacity = occupied === 'seat' ? 0.52 * (1 - settled * 0.84) : 0.52;
    mixer.update(dt);
    if (occupied === 'desk' && destination === 'desk' && settled > 0.9) {
      pencil.getWorldPosition(paperPoint);
      paperPoint.x += 0.014;
      paperPoint.z += 0.045;
      paperPoint.y = stations.desk.paperY;
      pencil.parent.worldToLocal(paperPoint);
      pencil.quaternion.setFromUnitVectors(nib, paperPoint.sub(pencil.position).normalize());
    }
    updateBlink(dt);
    // The upstream artist hides alternate expressions, clothes and props using zero scale.
    for (const part of parts) part.visible = part.scale.lengthSq() > 0.000001;
    pinAge = Math.min(1, pinAge + dt * 1.33);
    pin.visible = pinAge < 1;
    pin.material.opacity = 1 - pinAge;
    pin.scale.setScalar(1 + pinAge * 0.7);
  }

  const raycaster = new THREE.Raycaster(),
    pointer = new THREE.Vector2(),
    hit = new THREE.Vector3();
  const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const shelfFace = new THREE.Plane(new THREE.Vector3(1, 0, 0), 5.55);
  const boxes = Object.entries(stations).map(([name, s]) => [
    name,
    new THREE.Box3(new THREE.Vector3(...s.hit[0]), new THREE.Vector3(...s.hit[1])),
  ]);
  function rayAt(event) {
    const r = canvas.getBoundingClientRect();
    pointer.set(((event.clientX - r.left) / r.width) * 2 - 1, 1 - ((event.clientY - r.top) / r.height) * 2);
    raycaster.setFromCamera(pointer, view.camera);
    return raycaster.ray;
  }
  function stationAt(ray) {
    let near = Infinity,
      chosen = null;
    for (const [name, box] of boxes) {
      if (!ray.intersectBox(box, hit)) continue;
      const dist = ray.origin.distanceToSquared(hit);
      if (dist < near) {
        near = dist;
        chosen = name;
      }
    }
    return chosen;
  }
  let tap;
  canvas.addEventListener('pointerdown', (event) => {
    tap =
      event.isPrimary && event.button === 0
        ? { id: event.pointerId, x: event.clientX, y: event.clientY }
        : null;
  });
  canvas.addEventListener('pointermove', (event) => {
    if (tap && Math.hypot(event.clientX - tap.x, event.clientY - tap.y) > 6) tap = null;
    if (event.pointerType === 'mouse' && !event.buttons)
      canvas.style.cursor = stationAt(rayAt(event)) ? 'pointer' : 'grab';
  });
  canvas.addEventListener('pointercancel', () => {
    tap = null;
  });
  canvas.addEventListener('pointerup', (event) => {
    if (!tap || tap.id !== event.pointerId) return;
    tap = null;
    const ray = rayAt(event),
      station = stationAt(ray);
    if (station) {
      if (station === 'shelf' && ray.intersectPlane(shelfFace, hit)) {
        let nearest = 0;
        for (let i = 1; i < shelfOrigins.length; i++) {
          if (Math.abs(hit.y - shelfOrigins[i].y - 0.18) < Math.abs(hit.y - shelfOrigins[nearest].y - 0.18))
            nearest = i;
        }
        chooseBook(nearest);
      } else visit(station);
      return;
    }
    if (!ray.intersectPlane(floorPlane, hit)) return;
    if (
      hit.x < floorLimits.left - 0.4 ||
      hit.x > floorLimits.right + 0.2 ||
      hit.z < floorLimits.back - 0.24 ||
      hit.z > floorLimits.front + 0.52
    )
      return;
    held.clear();
    moveTo(hit.x, hit.z);
  });
  window.addEventListener('keydown', (event) => {
    if (about.open || reader.open || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey)
      return;
    if (directions[event.key]) {
      event.preventDefault();
      held.add(event.key);
      keyboardStep();
    } else if (!event.repeat) {
      if (event.code === 'KeyR') toggleStation('seat');
      if (event.code === 'KeyE') toggleStation('desk');
      if (event.code === 'KeyB') chooseBook(nextBook);
      if (event.code === 'KeyV') view.toggle();
    }
  });
  window.addEventListener('keyup', (event) => held.delete(event.key));
  window.addEventListener('blur', () => held.clear());
  about.addEventListener('close', () => held.clear());
  update(0);
  let previous,
    chimeTime = 0;
  document.addEventListener('visibilitychange', () => {
    previous = undefined;
    held.clear();
  });
  renderer.setAnimationLoop((time) => {
    const dt = Math.min((time - (previous ?? time)) / 1000, 0.28);
    previous = time;
    update(dt);
    if (!reducedMotion) {
      chimeTime += dt;
      chime.rotation.z = 0.065 * Math.sin(chimeTime * 0.84);
      chime.rotation.y = -0.12 + 0.11 * Math.sin(chimeTime * 0.53);
    }
    view.steer(dt);
    renderer.render(scene, view.camera);
  });
}

enterRoom().catch((error) => {
  console.error(error);
  status.textContent = '书房加载失败，请使用支持 WebGL 2 的浏览器重新打开。';
  readingButton.disabled = false;
  readingButton.textContent = '重新加载';
  readingButton.addEventListener('click', () => location.reload(), { once: true });
});
