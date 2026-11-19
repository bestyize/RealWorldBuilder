import * as THREE from 'three';
import { arowana } from '../fish/arowana/index.js';
import { vermilionArowana } from '../fish/vermilion-arowana/index.js';
import { createFeedingClearance } from './feeding-clearance.js';
import { planFeedingSwim } from './feeding-route.js';

const { clamp, smoothstep } = THREE.MathUtils;
const safeMin = new THREE.Vector3(-2.83, -.69, -.50);
const safeMax = new THREE.Vector3(2.83, 1.53, .80);
const crumbOffsets = [
  [-.36, -.04, .02], [.35, -.13, -.11], [-.11, .13, -.32],
  [.11, -.27, .21], [-.49, -.23, -.21], [.53, .06, .04],
];

function eatsPellets({ object }) {
  return object.name === arowana.id || object.name === vermilionArowana.id;
}

function offsetCruise(fish, time, offset, swim) {
  swim.cruiseTime = time + offset;
  fish.sampleCruise(swim.cruiseTime, swim.pace);
  swim.distance = swim.pace.distance;
  swim.speed = swim.pace.speed;
  return swim;
}

function finishFoodGeometry(geometry, base, toasted) {
  const positions = geometry.getAttribute('position');
  const colors = new Float32Array(positions.count * 3);
  const surface = new THREE.Color(base);
  const speckle = new THREE.Color(toasted);
  const color = new THREE.Color();
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const y = positions.getY(i);
    const z = positions.getZ(i);
    const grainTone = .5 + .5 * Math.sin(11 * x + 7 * y - 9 * z);
    const pores = Math.sin(23 * x - 29 * y + 13 * z) * Math.cos(17 * x + 19 * y + 22 * z);
    color.copy(surface).lerp(speckle, .17 * grainTone + .45 * smoothstep(pores, .18, .84))
      .toArray(colors, 3 * i);
    const unevenness = .97 + .025 * grainTone + .019 * pores;
    positions.setXYZ(i, x * unevenness, y * unevenness, z * unevenness);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geometry;
}

export function createFeeding(scene, onActiveChange) {
  const group = new THREE.Group();
  const profile = [
    [0, -.88], [.30, -.88], [.46, -.75], [.53, -.51], [.51, -.2], [.55, .09],
    [.53, .38], [.48, .69], [.34, .86], [0, .86],
  ].map(([radius, height]) => new THREE.Vector2(radius, height));
  const pelletGeometry = finishFoodGeometry(
    new THREE.LatheGeometry(profile, 20).rotateZ(-Math.PI / 2), 0x9b623c, 0x52301d,
  );
  const crumbGeometry = finishFoodGeometry(new THREE.IcosahedronGeometry(1, 0), 0xb68a64, 0x664332);
  const foodMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .85 });
  const grains = Array.from({ length: 9 }, () => {
    const grain = new THREE.Mesh(crumbGeometry, foodMaterial);
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
    const mixedDragon = fish.length > 1 && fish.find(eatsPellets);
    const swimmers = mixedDragon ? [mixedDragon, ...fish.filter(swimmer => swimmer !== mixedDragon)] : fish;
    const schooling = fish.length > 1;
    const servings = [];
    const crumbs = crumbOffsets.map(position => new THREE.Vector3(...position));
    let clearanceFor;

    function scatter(target, coarse, index) {
      const grain = grains[servings.length];
      grain.visible = true;
      grain.geometry = coarse ? pelletGeometry : crumbGeometry;
      const size = coarse ? .052 : .024 + .004 * (index % 3);
      grain.scale.set(size, size * .78, size * .86);
      const source = origin.clone().lerp(target, .10);
      grain.position.copy(source);
      const serving = { grain, source, target, size, index };
      servings.push(serving);
      return serving;
    }

    for (const [index, swimmer] of swimmers.entries()) {
      const coarse = eatsPellets(swimmer);
      const target = center.clone();
      if (coarse) target.y += .04;
      else {
        if (mixedDragon) {
          target.y -= .43;
          target.z -= .84;
        }
        // Closest available crumb first, so neighbours spread out as they approach.
        swimmer.getMouth(offset).sub(target);
        const order = crumbs.reduce((best, crumb, i) =>
          offset.distanceToSquared(crumb) < offset.distanceToSquared(crumbs[best]) ? i : best, 0);
        target.add(crumbs.splice(order, 1)[0]);
        if (mixedDragon) target.y = clamp(target.y, -1.25, .65);
      }
      const clearance = swimmer.clearanceRadius ? clearanceFor?.(swimmer) : undefined;
      const options = coarse
        ? { delay: .42, speed: 1.0, turnRadius: .98, tailDrive: true,
            cruiseOffset: cruises.get(swimmer)?.offset ?? 0 }
        : { delay: clearance ? .06 + .075 * index : .18 + .15 * index,
            speed: 1.08, turnRadius: schooling ? .37 : .54, clearance };
      let path = planFeedingSwim(swimmer, target, time, options);
      if (!path && clearance) {
        // A crumb can sink farther behind the dragon if the first approach is blocked.
        const alternate = target.clone().set(target.x * .84, Math.max(-1.25, target.y - .16), target.z - .44);
        path = planFeedingSwim(swimmer, alternate, time, { ...options, delay: .02 });
        if (path) target.copy(alternate);
      }
      if (path?.bitePoint) target.copy(path.bitePoint);
      const serving = scatter(target, coarse, index);
      if (!path) {
        serving.expires = time + 2.7;
        const detour = clearance?.bypass();
        if (detour) paths.set(swimmer, { path: detour });
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
      if (coarse) {
        const meal = serving.meal = { biteTime: path.biteTime };
        if (swimmer === mixedDragon) {
          const cruise = { pace: {} };
          clearanceFor = createFeedingClearance(swimmer, seconds => {
            const swim = path.at(seconds);
            if (swim) swim.meal = meal;
            swimmer.update(seconds, swim ?? (path.resumeOffset
              ? offsetCruise(swimmer, seconds, path.resumeOffset, cruise)
              : undefined));
          }, time, path.exitTime + swimmer.trail / .4);
        }
      }
      paths.set(swimmer, serving);
    }
    if (clearanceFor) mixedDragon.update(time, swimFor(mixedDragon, time));
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
    return offsetCruise(fish, time, cruise.offset, cruise.swim);
  }

  function update(time) {
    if (!round) return;
    const age = time - round.time;
    ripple.visible = age < .63;
    ripple.material.opacity = .54 * (1 - smoothstep(age, .06, .63));
    ripple.scale.setScalar(.035 + .35 * smoothstep(age, 0, .63));
    const tumble = .71 * age + 1 - Math.exp(-2.6 * age);

    for (const serving of round.servings) {
      const { grain, source, target, index, size, expires, fish, path, previous } = serving;
      if (!grain.visible) continue;
      grain.visible = time < expires;
      grain.position.copy(source).lerp(target, smoothstep(age, 0, .88));
      grain.position.y += .016 * Math.sin(age * 4.3 + index) * smoothstep(age, 0, .4);
      grain.rotation.set(.48 + .34 * Math.sin(.87 * age + index), tumble + .93 * index,
        .28 * Math.cos(.68 * age + 1.3 * index));
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
