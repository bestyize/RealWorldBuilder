import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { DoubleSide, Raycaster, Scene, Vector3 } from 'three';
import { createFeeding } from '../../src/feeding.js';
import { cruiseRoute, vermilionCruiseDuration } from '../../src/cruise-route.js';
import { cardinalTetra } from '../cardinal-tetra/index.js';
import { route as tetraRoute } from '../cardinal-tetra/route.js';
import { loadFish } from '../load-fish.js';
import { vermilionArowana } from './index.js';

test('the mouth levels at the food before biting on a climb or dive', async () => {
  globalThis.self = globalThis;
  globalThis.createImageBitmap = async () => ({ width: 1, height: 1 });
  const bytes = await readFile(new URL('./vermilion-arowana.glb', import.meta.url));
  const makeFish = await loadFish(vermilionArowana, Uint8Array.from(bytes).buffer);
  const fish = makeFish(cruiseRoute, { scale: .9, duration: vermilionCruiseDuration });
  const scene = new Scene();
  scene.add(fish.object);
  const feeding = createFeeding(scene, () => {});
  const pellet = scene.children.at(-1).children[0];
  const mouth = new Vector3();

  for (const [launch, foodY, direction] of [[4.6, 1.48, 1], [7.7, .48, 1], [4.6, -.65, -1]]) {
    const food = new Vector3(-.85, foodY, .65);
    feeding.reset();
    fish.update(launch);
    assert.ok(direction * (fish.getMouth(mouth).y - foodY) < 0);
    assert.equal(feeding.drop(food, launch, [fish]), true);
    const meal = feeding.swimFor(fish, launch).meal;
    let nearFrames = 0;
    let overshoot = 0;
    for (let frame = 0; frame <= Math.ceil((meal.biteTime + .3 - launch) * 60); frame++) {
      const time = launch + frame / 60;
      fish.update(time, feeding.swimFor(fish, time));
      feeding.update(time);
      if (meal.contact !== undefined) break;
      fish.getMouth(mouth);
      if (Math.hypot(mouth.x - pellet.position.x, mouth.z - pellet.position.z) > .95) continue;
      nearFrames++;
      overshoot = Math.max(overshoot, direction * (mouth.y - pellet.position.y));
    }
    assert.ok(nearFrames > 20, 'sampled the final approach');
    assert.ok(overshoot < .052, `mouth overshot food at height ${foodY} by ${overshoot}`);
    assert.ok(Math.abs(meal.contact - meal.biteTime) < .2, 'pellet was swallowed');
  }
});

test('mixed feeding guides the tetras around the dragon and back into formation', async () => {
  globalThis.self = globalThis;
  globalThis.createImageBitmap = async () => ({ width: 1, height: 1 });
  async function factory(species) {
    const bytes = await readFile(new URL(species.modelFile, new URL('../../', import.meta.url)));
    return loadFish(species, Uint8Array.from(bytes).buffer);
  }
  const [makeDragon, makeSchool] = await Promise.all([factory(vermilionArowana), factory(cardinalTetra)]);
  const dragon = makeDragon(cruiseRoute, { scale: .9, duration: vermilionCruiseDuration });
  const school = makeSchool(tetraRoute, { count: 6, duration: 36, feedable: true });
  school.object.scale.setScalar(.47);
  school.object.position.set(0, -.88, -.25);
  const scene = new Scene();
  scene.add(dragon.object, school.object);
  const members = school.getFeedingMembers();
  const feeding = createFeeding(scene, () => {});
  const grains = scene.children.at(-1).children.slice(0, 7);
  const body = dragon.object.getObjectByName('Body');
  body.material.side = DoubleSide;
  const probe = new Raycaster(new Vector3(), new Vector3(.199, .832, .517).normalize());
  const pose = () => school.getSchoolState().map(({ position, heading }) => [...position, ...heading]);

  for (const [launch, x, y, minimumBites] of [[2, 1.4, .28, 6], [22, -1.2, -.45, 7], [39, -1.2, -.45, 7]]) {
    feeding.reset();
    dragon.update(launch);
    school.update(launch);
    const initial = pose();
    assert.equal(feeding.drop(new Vector3(x, y, .65), launch, [dragon, ...members]), true);
    school.update(launch, feeding.swimFor);
    assert.ok(pose().every((values, i) => values.every((value, j) => Math.abs(value - initial[i][j]) < 1e-10)),
      'the detour starts on the cruise pose');
    const previous = school.getSchoolState().map(({ heading }) => heading.clone());
    const eaten = new Set();
    let time = launch;
    for (let frame = 1; feeding.active && frame <= 1800; frame++) {
      time = launch + frame / 60;
      dragon.update(time, feeding.swimFor(dragon, time));
      school.update(time, feeding.swimFor);
      feeding.update(time);
      for (const grain of grains) {
        if (!grain.visible && grain.scale.x > .005) eaten.add(grain);
      }
      for (const [index, { heading }] of school.getSchoolState().entries()) {
        const prior = previous[index];
        assert.ok(heading.angleTo(prior) < .22, `smooth turn at ${time}`);
        assert.ok(Math.abs(Math.asin(heading.y) - Math.asin(prior.y)) < .12, `smooth pitch at ${time}`);
        prior.copy(heading);
      }
      if (time === 5) {
        // This tetra used to pass through the belly at this exact point in the round.
        dragon.object.updateMatrixWorld(true);
        body.computeBoundingSphere();
        members[3].object.getWorldPosition(probe.ray.origin);
        const hits = probe.intersectObject(body, false)
          .filter((hit, index, all) => index === 0 || hit.distance - all[index - 1].distance > 1e-5);
        assert.equal(hits.length % 2, 0, 'the tetra is outside of the posed dragon body');
      }
    }
    assert.equal(feeding.active, false);
    assert.ok(eaten.size >= minimumBites, `the fish still reach their food at launch ${launch}`);
    const returned = pose();
    school.update(time);
    assert.deepEqual(pose(), returned);
  }
});
