import * as THREE from 'three';
import { blueGuppy } from '../fish/blue-guppy/index.js';
import { planFeedingSwim } from './feeding-route.js';

const { smoothstep } = THREE.MathUtils;
const safeMin = new THREE.Vector3(-2.83, -.69, -.50);
const safeMax = new THREE.Vector3(2.83, 1.53, .80);
const crumbOffsets = [
  [-.36, -.04, .02], [.35, -.13, -.11], [-.11, .13, -.32],
  [.11, -.27, .21], [-.49, -.23, -.21], [.53, .06, .04],
];

export function createFeeding(scene, onActiveChange) {
  const group = new THREE.Group();
  const geometry = new THREE.IcosahedronGeometry(1, 0);
  const pelletMaterial = new THREE.MeshStandardMaterial({
    color: 0xcb8f4f, emissive: 0xab6934, emissiveIntensity: .27, roughness: .92,
  });
  const crumbMaterial = new THREE.MeshStandardMaterial({
    color: 0xd7a472, emissive: 0xbd814e, emissiveIntensity: .29, roughness: .94,
  });
  const grains = Array.from({ length: 9 }, () => {
    const grain = new THREE.Mesh(geometry, crumbMaterial);
    group.add(grain);
    return grain;
  });
  const ripple = new THREE.Mesh(
    new THREE.RingGeometry(.9, 1, 48),
    new THREE.MeshBasicMaterial({ color: 0xffdaa0, transparent: true, depthWrite: false }),
  );
  group.add(ripple);
  group.visible = false;
  scene.add(group);

  const paths = new Map();
  const cruises = new Map();
  const offset = new THREE.Vector3();
  const segment = new THREE.Vector3();
  let round;

  function clear() {
    paths.clear();
    if (!round) return;
    round = undefined;
    group.visible = false;
    onActiveChange(false);
  }

  function reset() {
    cruises.clear();
    clear();
  }

  function drop(origin, time, fish) {
    if (round || !fish.length) return false;
    const center = origin.clone().clamp(safeMin, safeMax);
    const hasDragon = fish.some(swimmer => swimmer.object.name !== blueGuppy.id);
    const schooling = fish.length > 1;
    const servings = [];
    const crumbs = crumbOffsets.map(position => new THREE.Vector3(...position));

    function scatter(target, coarse, index) {
      const grain = grains[servings.length];
      grain.visible = true;
      grain.material = coarse ? pelletMaterial : crumbMaterial;
      const size = coarse ? .052 : .024 + .004 * (index % 3);
      grain.scale.set(size, size * .78, size * .86);
      const source = origin.clone().lerp(target, .10);
      grain.position.copy(source);
      const serving = { grain, source, target, size, index };
      servings.push(serving);
      return serving;
    }

    for (const [index, swimmer] of fish.entries()) {
      const coarse = swimmer.object.name !== blueGuppy.id;
      const target = center.clone();
      if (coarse) target.y += .04;
      else {
        if (hasDragon) {
          target.y -= .30;
          target.z -= .52;
        }
        // Closest available crumb first, so neighbours spread out as they approach.
        swimmer.getMouth(offset).sub(target);
        const order = crumbs.reduce((best, crumb, i) =>
          offset.distanceToSquared(crumb) < offset.distanceToSquared(crumbs[best]) ? i : best, 0);
        target.add(crumbs.splice(order, 1)[0]);
      }
      const serving = scatter(target, coarse, index);
      const path = planFeedingSwim(swimmer, target, time, coarse
        ? { delay: .42, speed: 1.0, turnRadius: .98, tailDrive: true,
            cruiseOffset: cruises.get(swimmer)?.offset ?? 0 }
        : { delay: .18 + .15 * index, speed: 1.08, turnRadius: schooling ? .37 : .54 });
      if (!path) {
        serving.expires = time + 2.7;
        continue;
      }
      if (coarse) {
        // Let the pellet settle at the lips of the posed fish. The mouth can
        // move slightly relative to the planned route as the trunk bends.
        swimmer.update(path.biteTime, path.at(path.biteTime));
        target.add(swimmer.getMouth(offset).sub(target).clampLength(0, .15));
        swimmer.update(time, swimFor(swimmer, time));
      }
      serving.fish = swimmer;
      serving.previous = new THREE.Vector3();
      serving.path = path;
      serving.expires = path.biteTime + .90;
      serving.biteRadius = coarse ? serving.size : .09;
      if (coarse) serving.meal = { biteTime: path.biteTime };
      paths.set(swimmer, serving);
    }
    for (let index = 0; index < 2; index++) {
      const target = center.clone().add(new THREE.Vector3(index ? .18 : -.23, -.14 - index * .09, .04));
      const fleck = scatter(target, false, fish.length + index);
      fleck.expires = time + 2.4 + index * .25;
    }
    for (const grain of grains.slice(servings.length)) grain.visible = false;
    ripple.position.copy(origin).addScaledVector(new THREE.Vector3(0, 0, 1), .04);
    round = { time, servings };
    group.visible = true;
    onActiveChange(true);
    return true;
  }

  function swimFor(fish, time) {
    const serving = paths.get(fish);
    if (serving) {
      const { path, meal } = serving;
      const swim = path.at(time);
      if (swim) {
        swim.meal = meal;
        return swim;
      }
      paths.delete(fish);
      if (path.resumeOffset) cruises.set(fish, { offset: path.resumeOffset, swim: { pace: {} } });
      else cruises.delete(fish);
    }
    const cruise = cruises.get(fish);
    if (!cruise) return;
    const { swim } = cruise;
    swim.cruiseTime = time + cruise.offset;
    fish.sampleCruise(swim.cruiseTime, swim.pace);
    swim.distance = swim.pace.distance;
    swim.speed = swim.pace.speed;
    return swim;
  }

  function update(time) {
    if (!round) return;
    const age = time - round.time;
    ripple.visible = age < .63;
    ripple.material.opacity = .54 * (1 - smoothstep(age, .06, .63));
    ripple.scale.setScalar(.035 + .35 * smoothstep(age, 0, .63));

    for (const serving of round.servings) {
      const { grain, source, target, index, size, expires, fish, path, previous } = serving;
      if (!grain.visible) continue;
      grain.visible = time < expires;
      grain.position.copy(source).lerp(target, smoothstep(age, 0, .88));
      grain.position.y += .016 * Math.sin(age * 4.3 + index) * smoothstep(age, 0, .4);
      grain.rotation.set(age * (1.4 + .2 * index), index + age * .83, .39 * index);
      const scale = size * (1 - smoothstep(time, expires - .35, expires));
      grain.scale.set(scale, scale * .78, scale * .86);
      if (fish && grain.visible) {
        fish.getMouth(offset).sub(grain.position);
        if (time > path.biteTime - .42) {
          // Sweep the relative mouth position across the last frame as well.
          segment.subVectors(offset, previous);
          const progress = THREE.MathUtils.clamp(-previous.dot(segment) / Math.max(1e-6, segment.lengthSq()), 0, 1);
          if (offset.lengthSq() < serving.biteRadius ** 2 ||
              (serving.sampled && segment.multiplyScalar(progress).add(previous).lengthSq() < serving.biteRadius ** 2)) {
            grain.visible = false;
            if (serving.meal) serving.meal.contact = time;
          }
        }
        previous.copy(offset);
        serving.sampled = true;
      }
    }
    if (!paths.size && round.servings.every(({ grain }) => !grain.visible)) clear();
  }

  return { clear, reset, drop, swimFor, update, get active() { return Boolean(round); } };
}

export function installFeedingInput(canvas, camera, feed) {
  const raycaster = new THREE.Raycaster();
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -.65);
  const coordinates = new THREE.Vector2();
  const point = new THREE.Vector3();
  let press;
  canvas.addEventListener('pointerdown', event => {
    if (event.button !== 0 || !event.isPrimary) {
      press = undefined;
      return;
    }
    press = { id: event.pointerId, x: event.clientX, y: event.clientY, radius: event.pointerType === 'touch' ? 12 : 6 };
    canvas.setPointerCapture(event.pointerId);
  });

  function withinPress(event) {
    return press?.id === event.pointerId &&
      Math.hypot(event.clientX - press.x, event.clientY - press.y) <= press.radius;
  }

  canvas.addEventListener('pointermove', event => {
    if (!withinPress(event)) press = undefined;
  });
  canvas.addEventListener('pointerup', event => {
    const tapped = withinPress(event);
    press = undefined;
    if (!tapped) return;
    const bounds = canvas.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width;
    const y = (event.clientY - bounds.top) / bounds.height;
    if (x < 0 || x > 1 || y < 0 || y > 1) return;
    coordinates.set(2 * x - 1, 1 - 2 * y);
    // The portrait fullscreen fallback rotates the canvas clockwise.
    if (document.documentElement.hasAttribute('data-landscape-fullscreen') &&
        matchMedia('(orientation: portrait)').matches) {
      coordinates.set(-coordinates.y, coordinates.x);
    }
    camera.updateMatrixWorld();
    raycaster.setFromCamera(coordinates, camera);
    if (raycaster.ray.intersectPlane(plane, point)) feed(point);
  });
  for (const event of ['pointerleave', 'pointercancel', 'lostpointercapture']) {
    canvas.addEventListener(event, () => { press = undefined; });
  }
}
