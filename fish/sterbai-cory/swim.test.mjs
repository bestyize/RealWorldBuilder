import test from 'node:test';
import assert from 'node:assert/strict';
import { BoxGeometry, Group, Mesh, MeshStandardMaterial, Vector3 } from 'three';
import { bottomDrive,createSwimmer } from './swim.js';
import { route } from './route.js';
function fixture(shared){const scene=new Group(),geometry=shared??new BoxGeometry(5.5,1.9,1.5,12,4,4);for(const name of ['CoryBody','CoryPectoral_L','CoryPelvic_R']){const mesh=new Mesh(geometry,new MeshStandardMaterial());mesh.name=name;scene.add(mesh);}return{scene,geometry};}
const verts=s=>{const out=[];s.traverse(m=>{if(m.isMesh)out.push(...m.geometry.attributes.position.array)});return out;};
test('six smooth search dashes have genuinely stationary investigation intervals',()=>{
 const a=bottomDrive(3),b=bottomDrive(4);assert.equal(a.progress,b.progress);assert.equal(a.speed,0);assert.ok(a.investigate>0);assert.ok(bottomDrive(1).speed>0);
 assert.equal(bottomDrive(36).progress,0);assert.ok(Math.abs(bottomDrive(2.64-1e-5).speed)<1e-7);
});
test('exact loop and arbitrary time seeks remain deterministic',()=>{
 const {scene}=fixture(),f=createSwimmer(scene,route);const a=verts(scene),p=scene.position.clone(),q=scene.quaternion.clone();f.update(36);assert.deepEqual(verts(scene),a);assert.ok(scene.position.distanceTo(p)<1e-9);assert.ok(scene.quaternion.angleTo(q)<1e-7);
 f.update(7.7);const expected=verts(scene);f.update(20);f.update(7.7);assert.deepEqual(verts(scene),expected);
});
test('all posed fin/body/barbel vertices stay above substrate through pauses and dashes',()=>{
 const {scene}=fixture(),f=createSwimmer(scene,route),point=new Vector3();
 for(let t=-1;t<37;t+=.17){f.update(t);scene.updateMatrixWorld(true);let minimum=Infinity;scene.traverse(m=>{if(!m.isMesh)return;const p=m.geometry.attributes.position;for(let i=0;i<p.count;i++){point.fromBufferAttribute(p,i).applyMatrix4(m.matrixWorld);minimum=Math.min(minimum,point.y);}});assert.ok(minimum>=.024999,`ground clearance at ${t}: ${minimum}`);assert.ok(minimum<.025001);}
});
test('investigation holds horizontal position while making a restrained nose pitch',()=>{
 const {scene}=fixture(),f=createSwimmer(scene,route);f.update(3);const a=scene.position.clone(),q=scene.quaternion.clone();f.update(4);assert.equal(scene.position.x,a.x);assert.equal(scene.position.z,a.z);assert.ok(scene.quaternion.angleTo(q)>0);assert.ok(scene.quaternion.angleTo(q)<.05);
});
test('independent instances do not mutate original geometry',()=>{
 const a=fixture(),b=fixture(a.geometry),rest=[...a.geometry.attributes.position.array],fa=createSwimmer(a.scene,route);createSwimmer(b.scene,route);const other=verts(b.scene);fa.update(2);assert.deepEqual(verts(b.scene),other);assert.deepEqual([...a.geometry.attributes.position.array],rest);
});
test('invalid timing rejected',()=>{assert.throws(()=>createSwimmer(fixture().scene,route,{duration:0}),/positive/);assert.throws(()=>createSwimmer(fixture().scene,route).update(NaN),/finite/);});
