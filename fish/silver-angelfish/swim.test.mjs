import test from 'node:test';
import assert from 'node:assert/strict';
import { BufferGeometry, Float32BufferAttribute, Group, Mesh, MeshStandardMaterial } from 'three';
import { createSwimmer } from './swim.js';
import { createSwimRoute } from '../swim-route.js';
const route = createSwimRoute([[0,0,.7],[1.5,0,.7],[1.5,.1,-.7],[-1.5,0,-.7],[-1.5,0,.7]]);
const names = ['AngelBody','AngelTail','AngelDorsal','AngelAnal','AngelPectoral_L','AngelPelvic_L'];
function fixture(shared) {
  const scene = new Group();
  const geometry = shared ?? new BufferGeometry();
  if (!shared) {
    geometry.setAttribute('position',new Float32BufferAttribute([1,0,.2, 0,.5,.2, -1.15,0,0, -2,0,.1, -.4,2,0, .3,-2,.2],3));
    geometry.setAttribute('normal',new Float32BufferAttribute(Array(6).fill([0,0,1]).flat(),3));
  }
  for (const name of names) { const mesh=new Mesh(geometry,new MeshStandardMaterial());mesh.name=name;scene.add(mesh); }
  return {scene,geometry};
}
const coords = scene => names.map(name=>[...scene.getObjectByName(name).geometry.attributes.position.array]);
test('exact loop and deterministic arbitrary seeking',()=>{
  const {scene}=fixture(); const fish=createSwimmer(scene,route); const a=coords(scene),pos=scene.position.clone(),q=scene.quaternion.clone();
  fish.update(48);assert.deepEqual(coords(scene),a);assert.ok(scene.position.distanceTo(pos)<1e-10);assert.ok(scene.quaternion.angleTo(q)<1e-7);
  fish.update(3.17);const expected=coords(scene);fish.update(25);fish.update(3.17);assert.deepEqual(coords(scene),expected);assert.notDeepEqual(expected,a);
  for(const t of [-100,1e6]) {fish.update(t);assert.ok(coords(scene).flat().every(Number.isFinite));}
});
test('compressed trunk and fin attachment roots stay fixed',()=>{
 const {scene}=fixture();const fish=createSwimmer(scene,route);fish.update(2.75);
 const body=coords(scene)[0];assert.deepEqual(body.slice(0,9),[1,0,.2,0,.5,.2,-1.15,0,0].map(Math.fround));
 for(const row of coords(scene)) assert.deepEqual(row.slice(6,9),[-1.15,0,0].map(Math.fround));
});
test('separate instances do not deform shared assets or each other',()=>{
 const a=fixture(),b=fixture(a.geometry),source=[...a.geometry.attributes.position.array];
 const fa=createSwimmer(a.scene,route);createSwimmer(b.scene,route);const before=coords(b.scene);fa.update(3.17);
 assert.deepEqual(coords(b.scene),before);assert.deepEqual([...a.geometry.attributes.position.array],source);
 assert.notEqual(a.scene.getObjectByName('AngelBody').geometry,b.scene.getObjectByName('AngelBody').geometry);
});
test('hover and short drift speed varies without reversing or stopping abruptly',()=>{
 const {scene}=fixture();const fish=createSwimmer(scene,route);const slow=fish.update(0).speed,fast=fish.update(12).speed;
 assert.ok(slow>0 && fast/slow>20);
});
test('long fin tips have restrained independent motion',()=>{
 const {scene}=fixture();const fish=createSwimmer(scene,route);fish.update(3.17);const rows=coords(scene);
 assert.notDeepEqual(rows[2],rows[0]);assert.notDeepEqual(rows[5],rows[0]);
 for(let t=0;t<48;t+=.7){fish.update(t);const p=coords(scene)[2];assert.ok(Math.abs(p[14])<.15);}
});
test('invalid timing fails explicitly',()=>{
 assert.throws(()=>createSwimmer(fixture().scene,route,{duration:0}),/positive/);
 const fish=createSwimmer(fixture().scene,route);assert.throws(()=>fish.update(NaN),/finite/);
});
