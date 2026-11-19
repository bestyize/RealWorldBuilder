import test from 'node:test';
import assert from 'node:assert/strict';
import { BoxGeometry, Group, Mesh, MeshStandardMaterial, Vector3 } from 'three';
import { createFeeding } from '../../src/feeding.js';
import { createSwimmer, bendAngle, SCHOOL_LIMIT } from './swim.js';
import { route } from './route.js';
function fixture(){const scene=new Group(),geometry=new BoxGeometry(2.6,.6,.34),material=new MeshStandardMaterial();for(const name of ['CardinalBody','CardinalTail']){const mesh=new Mesh(geometry,material);mesh.name=name;scene.add(mesh);}return{scene,geometry,material};}
const snapshot=fish=>fish.getSchoolState().map(s=>[...s.position,...s.heading,s.scale]);
test('ten fish share geometry/material per primitive with separate phase attributes',()=>{
 const {scene,geometry,material}=fixture();const before=[...geometry.attributes.position.array];const fish=createSwimmer(scene,route,{count:10});
 const a=scene.getObjectByName('CardinalBody'),b=scene.getObjectByName('CardinalTail');
 assert.ok(a.isInstancedMesh);assert.equal(a.count,SCHOOL_LIMIT);assert.equal(fish.budget.geometryCopies,2);assert.equal(fish.budget.materialCopies,1);assert.equal(a.material,b.material);assert.notEqual(a.material,material);
 assert.equal(new Set(a.geometry.attributes.tetraPhase.array).size,10);fish.update(2);assert.deepEqual([...geometry.attributes.position.array],before);
});
test('school is deterministic and closes position and heading at loop seam',()=>{
 const fish=createSwimmer(fixture().scene,route,{count:10});const initial=snapshot(fish);fish.update(42);assert.deepEqual(snapshot(fish),initial);
 fish.update(3.75);const a=snapshot(fish);fish.update(20);fish.update(3.75);assert.deepEqual(snapshot(fish),a);
});
test('loose school has different scale, headings and finite separated centers',()=>{
 const fish=createSwimmer(fixture().scene,route,{count:10});let minimum=Infinity;
 for(let t=0;t<42;t+=.25){fish.update(t);const states=fish.getSchoolState();assert.ok(snapshot(fish).flat().every(Number.isFinite));for(let i=0;i<10;i++)for(let j=i+1;j<10;j++)minimum=Math.min(minimum,states[i].position.distanceTo(states[j].position));}
 assert.ok(minimum>.55,`minimum center clearance ${minimum}`);
 assert.ok(new Set(fish.getSchoolState().map(s=>s.scale)).size>5);
 assert.ok(fish.getSchoolState()[0].heading.distanceTo(fish.getSchoolState()[9].heading)>.1);
});
test('single/school toggle retains ten allocated instances and restores deterministic school',()=>{
 const {scene}=fixture(),fish=createSwimmer(scene,route,{count:10});fish.update(4);const school=snapshot(fish);fish.setCount(1);fish.update(4);assert.equal(fish.getCount(),1);assert.equal(scene.getObjectByName('CardinalBody').count,1);assert.equal(fish.getSchoolState()[0].scale,1);fish.setCount(10);fish.update(4);assert.deepEqual(snapshot(fish),school);
});
test('GPU shader injection and CPU bending reference keep head stable',()=>{
 const {scene}=fixture();createSwimmer(scene,route,{count:10});const material=scene.getObjectByName('CardinalBody').material;
 const shader={uniforms:{},vertexShader:'#include <common>\n#include <beginnormal_vertex>\n#include <begin_vertex>'};material.onBeforeCompile(shader);
 assert.ok(shader.vertexShader.includes('attribute float tetraPhase'));assert.ok(shader.vertexShader.includes('transformed.xz='));assert.ok(shader.uniforms.tetraTime);
 assert.equal(bendAngle(.8,1),0);assert.ok(Math.abs(bendAngle(-1.8,2))<=.14);assert.notEqual(bendAngle(-1.8,1),bendAngle(-1.8,2));
});
test('reject invalid counts and times',()=>{assert.throws(()=>createSwimmer(fixture().scene,route,{count:11}),/1–10/);assert.throws(()=>createSwimmer(fixture().scene,route,{duration:0}),/positive/);const f=createSwimmer(fixture().scene,route);assert.throws(()=>f.update(NaN),/finite/);});

test('six instanced tetras eat separate crumbs and rejoin their routes', () => {
 const { scene: group } = fixture();
 const tank = new Group();
 tank.add(group);
 group.scale.setScalar(.64);
 group.position.set(0, .17, -.29);
 const fish = createSwimmer(group, route, { count: 6, duration: 36, feedable: true });
 const feeding = createFeeding(tank, () => {});
 const members = fish.getFeedingMembers();
 const crumbs = tank.children.at(-1).children.slice(0, members.length);
 const launch = 7.5;
 fish.update(launch);
 assert.equal(members.length, 6);
 assert.equal(feeding.drop(new Vector3(1.9, -.52, .65), launch, members), true);
 const eaten = new Set();
 let time = launch;
 for (let frame = 0; frame < 1800 && feeding.active; frame++) {
  time = launch + frame / 60;
  fish.update(time, feeding.swimFor);
  feeding.update(time);
  for (const crumb of crumbs) {
   if (!crumb.visible && crumb.scale.x > .005) eaten.add(crumb);
  }
 }
 assert.equal(eaten.size, 6);
 assert.equal(feeding.active, false);
 const settled = snapshot(fish);
 fish.update(time);
 assert.deepEqual(snapshot(fish), settled);
 fish.setCount(1);
 assert.equal(fish.getFeedingMembers().length, 1);
 assert.notEqual(fish.getFeedingMembers()[0], members[0]);
 fish.setCount(6);
 assert.equal(fish.getFeedingMembers(), members);
});
