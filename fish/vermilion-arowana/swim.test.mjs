import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { Scene, Vector3 } from 'three';
import { createFeeding } from '../../src/feeding.js';
import { cruiseRoute } from '../../src/cruise-route.js';
import { loadFish } from '../load-fish.js';
import { vermilionArowana } from './index.js';

test('the mouth levels at the food before biting on a climb or dive', async () => {
  globalThis.self = globalThis;
  globalThis.createImageBitmap = async () => ({ width: 1, height: 1 });
  const bytes = await readFile(new URL('./vermilion-arowana.glb', import.meta.url));
  const makeFish = await loadFish(vermilionArowana, Uint8Array.from(bytes).buffer);
  const fish = makeFish(cruiseRoute, { scale: .9, duration: 32 });
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
