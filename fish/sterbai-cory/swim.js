import { MathUtils, Matrix4, Mesh, Quaternion, Vector3 } from 'three';
const TAU=Math.PI*2, UP=new Vector3(0,1,0), SIDE=new Vector3(0,0,1);
/** Six short bottom searches, each followed by stationary nose investigation. */
export function bottomDrive(seconds,duration=36){
 const p=MathUtils.euclideanModulo(seconds/duration,1), lap=p*6,step=Math.floor(lap),u=lap-step;
 const m=Math.min(1,u/.44),ease=m*m*m*(m*(m*6-15)+10);
 const speed=u<.44?30*m*m*(m-1)*(m-1)/.44:0;
 const hold=Math.max(0,(u-.44)/.56);
 return {progress:(step+ease)/6,speed,investigate:Math.sin(Math.PI*hold)**2,phase:TAU*Math.round(duration*.85)*p};
}
export function createSwimmer(scene,route,{duration=36,floorY=0}={}){
 if(!(duration>0)||!Number.isFinite(duration))throw new Error('Cory duration must be positive');
 if(!Number.isFinite(floorY))throw new Error('Cory floor must be finite');
 scene.updateWorldMatrix(true,true);const inverse=scene.matrixWorld.clone().invert(),sources=[];
 scene.traverse(o=>{if(o.isMesh)sources.push(o);});
 const parts=sources.map(source=>{
  const geometry=source.geometry.clone();geometry.applyMatrix4(new Matrix4().multiplyMatrices(inverse,source.matrixWorld));geometry.deleteAttribute('tangent');
  const mesh=new Mesh(geometry,source.material);mesh.name=source.name;mesh.frustumCulled=false;source.removeFromParent();scene.add(mesh);
  return {mesh,position:geometry.attributes.position,normal:geometry.attributes.normal,rest:geometry.attributes.position.array.slice(),restNormal:geometry.attributes.normal?.array.slice()};
 });
 const tangent=new Vector3(),side=new Vector3(),up=new Vector3(),matrix=new Matrix4(),pitch=new Quaternion();
 const motion={center:new Vector3(),heading:new Vector3(),speed:0,phase:0,clearance:.025,investigating:false};
 const start=route.samples[route.startIndex]?.distance??0;
 function update(seconds){
  if(!Number.isFinite(seconds))throw new Error('Cory time must be finite');
  const d=bottomDrive(seconds,duration);route.sample(start+route.length*d.progress,motion.center,tangent);
  for(const {mesh,position,normal,rest,restNormal}of parts){
   for(let i=0;i<rest.length;i+=3){
    const x=rest[i],y=rest[i+1],z=rest[i+2],aft=Math.max(0,-.65-x);
    const a=(.018+.025*Math.min(1,d.speed/3))*Math.min(1,aft*aft)*Math.sin(d.phase-aft),c=Math.cos(a),s=Math.sin(a);
    let py=y,pz=(x+.65)*s+z*c;
    if(/Pectoral|Pelvic/.test(mesh.name)){
     const free=Math.max(0,Math.abs(z)-(/Pectoral/.test(mesh.name)?.30:.22)),scull=(.025+.06*Math.min(1,d.speed/3))*Math.sin(d.phase*2);
     py+=free*scull;pz+=Math.sign(z)*free*.03*Math.cos(d.phase*2);
    }
    position.array[i]=-.65+(x+.65)*c-z*s;position.array[i+1]=py;position.array[i+2]=pz;
    if(normal&&restNormal){normal.array[i]=c*restNormal[i]-s*restNormal[i+2];normal.array[i+1]=restNormal[i+1];normal.array[i+2]=s*restNormal[i]+c*restNormal[i+2];}
   }
   position.needsUpdate=true;if(normal)normal.needsUpdate=true;
  }
  side.crossVectors(tangent,UP).normalize();up.crossVectors(side,tangent).normalize();
  scene.quaternion.setFromRotationMatrix(matrix.makeBasis(tangent,up,side));
  scene.quaternion.multiply(pitch.setFromAxisAngle(SIDE,-.045*d.investigate));
  matrix.makeRotationFromQuaternion(scene.quaternion);const e=matrix.elements;let minY=Infinity;
  // Exact posed-vertex support height, including barbels/fin tips, prevents substrate penetration.
  for(const {position}of parts)for(let i=0;i<position.array.length;i+=3){const p=position.array;minY=Math.min(minY,e[1]*p[i]*scene.scale.x+e[5]*p[i+1]*scene.scale.y+e[9]*p[i+2]*scene.scale.z);}
  motion.center.y=floorY-minY+motion.clearance;scene.position.copy(motion.center);motion.heading.copy(tangent);
  motion.speed=route.length/duration*d.speed;motion.phase=d.phase;motion.investigating=d.investigate>.01;
  return motion;
 }
 update(0);return{update,getMotion:()=>motion,duration};
}
