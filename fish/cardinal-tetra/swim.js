import { DynamicDrawUsage, InstancedBufferAttribute, InstancedMesh, MathUtils, Matrix4, Object3D, Quaternion, Vector3 } from 'three';
import { createSwimRoute } from '../swim-route.js';

const TAU = Math.PI * 2;
export const SCHOOL_LIMIT = 10;
// Deliberately irregular along/side/height offsets, not a marching grid.
export const MEMBERS = [
 [2.6,-.15,.25,.54,.02],[1.5,.85,-.45,.49,.39],[1.1,-.9,.65,.52,.71],
 [.25,.15,-.8,.47,.19],[-.1,-1.1,-.15,.50,.56],[-.8,.95,.5,.53,.88],
 [-1.45,-.35,.85,.48,.31],[-1.9,.65,-.65,.51,.64],[-2.55,-.95,-.55,.46,.95],[-2.9,.3,.12,.50,.12],
];
export const TAIL_ROOT = -.65;
export function bendAngle(x, phase) {
 const aft=Math.max(0,TAIL_ROOT-x);
 return .14*Math.min(1,aft*aft)*Math.sin(phase-aft*1.8);
}
const bendGLSL = `
attribute float tetraPhase;
uniform float tetraTime;
float tetraBend(float x) {
 float aft=max(0.0,-0.65-x);
 return 0.14*min(1.0,aft*aft)*sin(tetraTime+tetraPhase-aft*1.8);
}
`;
/** One geometry and one material per primitive, ten GPU instances, no vertex uploads per frame. */
export function createSwimmer(scene, route, { duration=42, count=1, phaseOffset=0, feedable=false }={}) {
 if(!(duration>0)||!Number.isFinite(duration)) throw new Error('Tetra duration must be positive');
 if(!Number.isInteger(count)||count<1||count>SCHOOL_LIMIT) throw new Error('Tetra count must be 1–10');
 const schoolCount=count, uniform={value:0}, parts=[], materials=new Map();
 scene.updateWorldMatrix(true,true);
 const inverse=scene.matrixWorld.clone().invert(), sources=[];
 scene.traverse(o=>{if(o.isMesh)sources.push(o);});
 function materialFor(source) {
  if(materials.has(source))return materials.get(source);
  const material=source.clone();
  material.onBeforeCompile=shader=>{
   shader.uniforms.tetraTime=uniform;
   shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\n'+bendGLSL)
    .replace('#include <beginnormal_vertex>',`#include <beginnormal_vertex>
     float fishA=tetraBend(position.x); float fishC=cos(fishA); float fishS=sin(fishA);
     objectNormal.xz=mat2(fishC,fishS,-fishS,fishC)*objectNormal.xz;`)
    .replace('#include <begin_vertex>',`#include <begin_vertex>
     transformed.xz=mat2(fishC,fishS,-fishS,fishC)*vec2(position.x+0.65,position.z)-vec2(0.65,0.0);`);
  };
  material.customProgramCacheKey=()=> 'cardinal-tetra-tail-v1';
  materials.set(source,material);return material;
 }
 for(const source of sources) {
  const geometry=source.geometry.clone();geometry.applyMatrix4(new Matrix4().multiplyMatrices(inverse,source.matrixWorld));
  geometry.deleteAttribute('tangent');
  geometry.setAttribute('tetraPhase',new InstancedBufferAttribute(new Float32Array(MEMBERS.map(m=>m[4]*TAU)),1));
  const material=Array.isArray(source.material)?source.material.map(materialFor):materialFor(source.material);
  const mesh=new InstancedMesh(geometry,material,SCHOOL_LIMIT);mesh.name=source.name;mesh.count=count;mesh.frustumCulled=false;
  mesh.instanceMatrix.setUsage(DynamicDrawUsage);source.removeFromParent();scene.add(mesh);parts.push(mesh);
 }
 const pos=new Vector3(),heading=new Vector3(),side=new Vector3(),up=new Vector3(),scale=new Vector3(),matrix=new Matrix4(),rotation=new Quaternion();
 const motion={center:new Vector3(),heading:new Vector3(),speed:0,phase:0};
 const start=route.samples[route.startIndex]?.distance??0;
 let activeCount=count;
 const states=MEMBERS.map(()=>({position:new Vector3(),heading:new Vector3(),scale:1}));

 function followGuide(index, progress, loose) {
  const [along, lane, height, , phase] = MEMBERS[index];
  const angle = TAU * progress;
  const variation = progress + .012 * Math.sin(2 * angle + phase * TAU);
  route.sample(start + route.length * variation + (loose ? along : 0), pos, heading);
  if (loose) {
   side.set(-heading.z, 0, heading.x).normalize();
   pos.addScaledVector(side, lane + .12 * Math.sin(2 * angle + phase * TAU));
   pos.y += height + .10 * Math.sin(3 * angle - phase * TAU);
  }
 }

 function feedingMember(index, loose) {
  // Give the planner the full loop of this individual, including the school's drift.
  const waypoints = Array.from({ length: 96 }, (_, step) => {
   followGuide(index, step / 96, loose);
   return pos.toArray();
  });
  const track = createSwimRoute(waypoints, 0, { samplesPerWaypoint: 6 });
  const steps = track.samples.length - 1;
  const size = loose ? MEMBERS[index][3] : 1;
  const object = new Object3D();
  const snout = new Vector3(1.28, .045, 0);
  scene.add(object);
  return {
   object, route: track, duration, mouthOffset: snout.clone().multiplyScalar(size),
   trail: 1.82 * size, clearanceRadius: .66 * size,
   getMouth: target => object.localToWorld(target.copy(snout)),
   sampleCruise(seconds, out) {
    const frame = MathUtils.euclideanModulo(seconds / duration + phaseOffset, 1) * steps;
    const index = Math.min(steps - 1, Math.floor(frame));
    const a = track.samples[index].distance;
    const b = track.samples[index + 1].distance;
    out.distance = MathUtils.lerp(a, b, frame - index);
    out.speed = (b - a) * steps / duration;
   },
  };
 }

 const solo = feedable ? [feedingMember(0, false)] : undefined;
 const school = feedable && count > 1 ? Array.from({ length: count }, (_, i) => feedingMember(i, true)) : undefined;
 const getFeedingMembers = () => activeCount === 1 ? solo : school;
 const pace = {};

 function update(seconds, swimFor) {
  if(!Number.isFinite(seconds))throw new Error('Tetra time must be finite');
  const p=MathUtils.euclideanModulo(seconds/duration+phaseOffset,1);
  uniform.value=TAU*Math.round(duration*1.65)*p;
  motion.center.set(0,0,0);
  motion.speed = 0;
  const members = getFeedingMembers();
  const loose = activeCount > 1;
  for(let i=0;i<activeCount;i++) {
   const member = members?.[i];
   if (member) {
    member.sampleCruise(seconds, pace);
    const swim = swimFor?.(member, seconds);
    const sample = swim?.sample ?? member.route.sample;
    sample(swim?.distance ?? pace.distance, pos, heading);
    motion.speed += swim?.speed ?? pace.speed;
   } else {
    followGuide(i, p, loose);
    motion.speed += route.length / duration;
   }
   side.set(-heading.z,0,heading.x).normalize();
   up.crossVectors(side,heading).normalize();
   rotation.setFromRotationMatrix(matrix.makeBasis(heading,up,side));
   const s=loose?MEMBERS[i][3]:1;scale.setScalar(s);matrix.compose(pos,rotation,scale);
   if (member) {
    member.object.position.copy(pos);
    member.object.quaternion.copy(rotation);
    member.object.scale.copy(scale);
   }
   for(const mesh of parts)mesh.setMatrixAt(i,matrix);
   states[i].position.copy(pos);states[i].heading.copy(heading);states[i].scale=s;
   motion.center.add(pos);
  }
  motion.center.divideScalar(activeCount);motion.heading.copy(states[0].heading);
  if (members) scene.localToWorld(motion.center);
  motion.speed /= activeCount;
  motion.phase=uniform.value;
  for(const mesh of parts)mesh.instanceMatrix.needsUpdate=true;
  return motion;
 }
 function setCount(next) {
  if(next!==1&&next!==schoolCount)throw new Error('Choose single or the configured school');
  activeCount=next;for(const part of parts)part.count=next;
 }
 update(0);
 return {update,getMotion:()=>motion,duration,setCount,getCount:()=>activeCount,getFeedingMembers,
  getSchoolState:()=>states.slice(0,activeCount),
  budget:{maxInstances:SCHOOL_LIMIT,meshPrimitives:parts.length,geometryCopies:parts.length,materialCopies:materials.size},
 };
}
