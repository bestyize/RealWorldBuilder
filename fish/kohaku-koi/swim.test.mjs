import test from 'node:test';
import assert from 'node:assert/strict';
import { BoxGeometry, BufferGeometry, Float32BufferAttribute, Group, Mesh, MeshStandardMaterial } from 'three';
import { createSwimmer } from './swim.js';
import { createSwimRoute } from '../swim-route.js';

const route = createSwimRoute([[0, 0, 1], [3, .1, 1], [3, .2, -1], [-3, .1, -1], [-3, 0, 1]]);
function fixture(geometry = new BoxGeometry(5.5, 1, .6, 20, 3, 3)) {
  const scene = new Group();
  const child = new Mesh(geometry, new MeshStandardMaterial());
  child.name = 'KoiBody';
  scene.add(child);
  return { scene, child, geometry };
}
function values(mesh) { const active = mesh.parent?.getObjectByName(mesh.name) ?? mesh; return [...active.geometry.attributes.position.array]; }

test('koi loops without a position, heading or mesh seam', () => {
  const { scene } = fixture();
  const fish = createSwimmer(scene, route);
  const child = scene.getObjectByName("KoiBody");
  fish.update(0);
  const start = values(child), position = scene.position.clone(), rotation = scene.quaternion.clone();
  fish.update(fish.duration);
  assert.deepEqual(values(child), start);
  assert.ok(scene.position.distanceTo(position) < 1e-9);
  assert.ok(scene.quaternion.angleTo(rotation) < 1e-7);
});
test('seeking is deterministic, finite and moves the tail', () => {
  const { scene } = fixture();
  const fish = createSwimmer(scene, route);
  const child = scene.getObjectByName("KoiBody");
  const start = values(child);
  fish.update(3.15); const expected = values(child);
  assert.notDeepEqual(expected, start);
  fish.update(8); fish.update(3.15);
  assert.deepEqual(values(child), expected);
  for (const time of [-100, 0, 19, 38, 1e6]) {
    fish.update(time);
    assert.ok(values(child).every(Number.isFinite));
    assert.ok([...child.geometry.attributes.normal.array].every(Number.isFinite));
  }
});
test('instances do not mutate their shared source or each other', () => {
  const a = fixture(), b = fixture(a.geometry);
  const source = [...a.geometry.attributes.position.array];
  const fishA = createSwimmer(a.scene, route), fishB = createSwimmer(b.scene, route);
  a.child = a.scene.getObjectByName("KoiBody");
  b.child = b.scene.getObjectByName("KoiBody");
  const other = values(b.child);
  fishA.update(8);
  assert.deepEqual(values(b.child), other);
  assert.deepEqual([...a.geometry.attributes.position.array], source);
  assert.notEqual(a.child.geometry, b.child.geometry);
  fishB.update(9);
  assert.notDeepEqual(values(a.child), values(b.child));
});
test('invalid duration fails rather than generating NaN poses', () => {
  assert.throws(() => createSwimmer(fixture().scene, route, { duration: 0 }), /positive/);
});


test('bending rotates tail cross-sections without stretching their width or moving the head', () => {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute([2,0,0, -2,0,-.3, -2,0,.3, -3,0,0], 3));
  geometry.setAttribute('normal', new Float32BufferAttribute([1,0,0, 0,0,-1, 0,0,1, -1,0,0], 3));
  const { scene } = fixture(geometry);
  const fish = createSwimmer(scene, route);
  fish.update(3.7);
  const points = scene.getObjectByName('KoiBody').geometry.attributes.position.array;
  assert.deepEqual([...points.slice(0, 3)], [2, 0, 0]);
  assert.ok(Math.abs(Math.hypot(points[3]-points[6], points[4]-points[7], points[5]-points[8])-.6) < 1e-6);
  assert.ok(Math.abs(points[3] - points[6]) > .0001, 'the ring rotates, rather than a lateral shear');
});
test('swim drive alternates effort and glide while advancing monotonically', () => {
  const { scene } = fixture();
  const fish = createSwimmer(scene, route);
  const speeds = [];
  for (let t = 0; t < fish.duration; t += .5) speeds.push(fish.update(t).speed);
  assert.ok(Math.min(...speeds) > 0);
  assert.ok(Math.max(...speeds) / Math.min(...speeds) > 1.3);
});

test('the trunk and tail bend inside the turn in either direction', () => {
  for (const direction of [-1, 1]) {
    const circle = createSwimRoute(Array.from({ length: 16 }, (_, i) => {
      const angle = i * Math.PI / 8;
      return [4 * Math.sin(angle), 0, direction * 4 * Math.cos(angle)];
    }));
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute([0, 0, 0, -1.2, 0, 0, -3, 0, 0], 3));
    const { scene } = fixture(geometry);
    const fish = createSwimmer(scene, circle);
    const { array } = scene.getObjectByName('KoiBody').geometry.attributes.position;

    let trunk = 0, tail = 0;
    for (let frame = 0; frame < 64; frame++) {
      const motion = fish.update(fish.duration * frame / 64);
      assert.equal(Math.sign(motion.turn), direction);
      trunk += -direction * (array[5] - array[2]) / 64;
      tail += -direction * (array[8] - array[2]) / 64;
    }
    assert.ok(trunk > .18, 'the trunk flexes with the route');
    assert.ok(tail > trunk + .42, 'the tail follows through on the inside of the arc');
  }
});
