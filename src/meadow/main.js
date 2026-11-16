import * as T from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { meadowAssets } from '../../scripts/meadow-assets.mjs';

const $=id=>document.getElementById(id),stage=$('meadow-stage'), status=$('meadow-status');
const rng=seed=>()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296;};
const random=rng(507319), range=(a,b)=>a+(b-a)*random();
const heightField=(x,z)=>.007*(8-z)+.36*Math.sin(z*.062+x*.046)+.28*Math.sin(x*.144-z*.051)+.11*Math.sin(x*.32+z*.15)+2.2*Math.exp(-((x+35)**2+(z+74)**2)/950);
// Anchor small leaves and flower stems to the same triangular surface as the
// ground mesh. Sampling the smooth height field would bury short grass in
// between coarse terrain vertices.
const terrain={w:420,d:350,x0:-210,z0:-253,nx:142,nz:110};
function surface(x,z){
  const {w,d,x0,z0,nx,nz}=terrain,dx=w/nx,dz=d/nz;
  const gx=(x-x0)/dx,gz=(z-z0)/dz,ix=Math.floor(gx),iz=Math.floor(gz),tx=gx-ix,tz=gz-iz;
  const x1=x0+ix*dx,z1=z0+iz*dz;
  const a=heightField(x1,z1),b=heightField(x1,z1+dz),
        c=heightField(x1+dx,z1+dz),h=heightField(x1+dx,z1);
  return tx+tz<=1?a+tx*(h-a)+tz*(b-a):c+(1-tx)*(b-c)+(1-tz)*(h-c);
}
const trail=z=>.1+(14-z)*.12+2.1*Math.sin((14-z)*.075);
const pathMix=(x,z)=>Math.max(0,1-Math.abs(x-trail(z))/(.72+Math.max(0,14-z)*.012));
const palettes=[0x7b9257,0x9ba965,0x5a7949,0x7a9558,0xb8b173].map(c=>new T.Color(c));
const terrainColor=(x,z,r)=>{
  const t=Math.max(0,Math.min(1,.5+.21*Math.sin(x*.14+z*.09)+.13*Math.sin(z*.38-x*.32)+.07*Math.sin(z*.9+x*1.4)+r*.08));
  const p=pathMix(x,z);
  const shade=Math.exp(-((x-10.5)**2+(z+9)**2)/36);
  return palettes[2].clone().lerp(palettes[1],t).lerp(palettes[4],p*.29).multiplyScalar(1.06+r*.17-shade*.23);
};
function groundDetail(){
  // Seamless tonal variation for the underlying fine turf, not a scene image.
  const canvas=document.createElement('canvas');canvas.width=canvas.height=512;
  const ctx=canvas.getContext('2d'),r=rng(19442),n=512;
  ctx.fillStyle='#e3e9d3';ctx.fillRect(0,0,n,n);
  for(let i=0;i<840;i++){
    const x=r()*n,y=r()*n,w=2+r()*13,step=.02+r()*.10,dark=r()<.60;
    ctx.fillStyle=dark?`rgba(78,101,53,${step})`:`rgba(255,246,201,${step})`;
    for(const dx of [-n,0,n])for(const dy of [-n,0,n]){
      ctx.beginPath();ctx.ellipse(x+dx,y+dy,w,w*.66,r()*3,0,Math.PI*2);ctx.fill();
    }
  }
  for(let i=0;i<29000;i++){
    const x=r()*n,y=r()*n,len=1+r()*4.4,ang=r()*Math.PI*2;
    ctx.strokeStyle=r()<.5?'#8caa6775':'#4d6a336a';
    ctx.lineWidth=.35+r()*.82;
    ctx.beginPath();ctx.moveTo(x,y);ctx.quadraticCurveTo(x+Math.cos(ang)*len*.45+1,y+Math.sin(ang)*len*.5,x+Math.cos(ang)*len,y+Math.sin(ang)*len);ctx.stroke();
  }
  const map=new T.CanvasTexture(canvas);map.wrapS=map.wrapT=T.RepeatWrapping;map.colorSpace=T.SRGBColorSpace;map.anisotropy=4;
  return map;
}
function makeTerrain(){
  const geom=new T.PlaneGeometry(terrain.w,terrain.d,terrain.nx,terrain.nz);
  geom.rotateX(-Math.PI/2).translate(0,0,-78);
  const points=geom.getAttribute('position'), uv=geom.getAttribute('uv'), colors=new Float32Array(points.count*3), rnd=rng(124027);
  for(let i=0;i<points.count;i++){
    const x=points.getX(i),z=points.getZ(i);
    points.setY(i,heightField(x,z));uv.setXY(i,x/3.7,z/3.7);terrainColor(x,z,rnd()).toArray(colors,i*3);
  }
  geom.setAttribute('color',new T.BufferAttribute(colors,3));geom.computeVertexNormals();
  const object=new T.Mesh(geom,new T.MeshLambertMaterial({vertexColors:true,map:groundDetail()}));
  object.receiveShadow=true;
  return object;
}
function makeSward(){
  const v=[], colors=[], normals=[], rnd=rng(82217);
  const push=(x,y,z,c)=>{v.push(x,y,z);colors.push(c.r,c.g,c.b);normals.push(.16,.974,-.12);};
  const straw=new T.Color(0xb1aa69);
  for(let i=0;i<68000;i++){
    const near=i<51500, x=near?-1.55+(rnd()-.5)*14:(rnd()-.5)*78, z=near?16-rnd()*15:16-rnd()*65;
    const path=pathMix(x,z);
    if(path>.48&&rnd()<path*.36)continue;
    const angle=rnd()*6.283, w=.0012+rnd()*.0028, h=(.026+rnd()**1.32*.127)*(1-path*.65)*(near?1:1.3);
    const cos=Math.cos(angle),sin=Math.sin(angle),y=surface(x,z)-.006,lean=(.025+rnd()*.051)*(1-path*.40);
    const bend=rnd()*6.283,bx=Math.cos(bend)*lean,bz=Math.sin(bend)*lean;
    const base=terrainColor(x,z,rnd()).multiplyScalar(.74);
    const mid=base.clone().lerp(straw,rnd()*.15).multiplyScalar(1.32+rnd()*.34);
    const tip=mid.clone().lerp(straw,rnd()*.12).multiplyScalar(1.1);
    const A=[x-cos*w,y,z-sin*w],B=[x+cos*w,y,z+sin*w],
      C=[x+bx*.22+cos*w*.66,y+h*.53,z+bz*.22+sin*w*.66],D=[x+bx*.22-cos*w*.66,y+h*.53,z+bz*.22-sin*w*.66],
      E=[x+bx*.75+cos*w*.28,y+h*.9,z+bz*.75+sin*w*.28],F=[x+bx*.75-cos*w*.28,y+h*.9,z+bz*.75-sin*w*.28];
    push(...A,base);push(...B,base);push(...C,mid);
    push(...A,base);push(...C,mid);push(...D,mid);
    push(...D,mid);push(...C,mid);push(...E,tip);
    push(...D,mid);push(...E,tip);push(...F,tip);
    push(...F,tip);push(...E,tip);push(x+bx,y+h,z+bz,tip);
  }
  const geometry=new T.BufferGeometry();
  geometry.setAttribute('position',new T.Float32BufferAttribute(v,3));
  geometry.setAttribute('normal',new T.Float32BufferAttribute(normals,3));
  geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));geometry.computeBoundingSphere();
  return new T.Mesh(geometry,new T.MeshLambertMaterial({side:T.DoubleSide,vertexColors:true}));
}
function makeSky(){
  const sky=new T.Mesh(new T.SphereGeometry(320,30,16),new T.ShaderMaterial({
    side:T.BackSide,depthWrite:false,
    uniforms:{top:{value:new T.Color(0xa6c5ce)},horizon:{value:new T.Color(0xf1e8d3)},sunTint:{value:new T.Color(0xffe5bb)}},
    vertexShader:`varying vec3 p;void main(){p=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`varying vec3 p;uniform vec3 top;uniform vec3 horizon;uniform vec3 sunTint;
      void main(){vec3 d=normalize(p);float t=pow(clamp(d.y*1.8,0.,1.),.58);
      float glow=pow(max(0.,dot(d,normalize(vec3(-.58,.32,-.72)))),11.);
      gl_FragColor=vec4(mix(mix(horizon,top,t),sunTint,glow*.44),1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`
  }));
  sky.frustumCulled=false;sky.renderOrder=-10;return sky;
}
function generateClusters(cx,cz,n,radius,rise=.95){
  return Array.from({length:n},()=>{
    const angle=range(0,2*Math.PI),r=Math.sqrt(random())*radius;
    return [cx+Math.cos(angle)*r,cz+Math.sin(angle)*r,range(.72,1.3)*rise,range(0,Math.PI*2)];
  });
}
function spread(n,width,far,avoid=.16,mult=1){
  const out=[];
  for(let i=0;i<n*4&&out.length<n;i++){
    const x=range(-width,width),z=range(-far,16);
    if(pathMix(x,z)>avoid)continue;
    const noise=.56+.24*Math.sin(x*.59+z*.21)+.20*Math.cos(z*.55-x*.12);
    if(random()>noise)continue;
    out.push([x,z,range(.73,1.32)*mult,range(0,Math.PI*2)]);
  }
  return out;
}
// The composed scene uses lighter materials for plants seen at distance.
// Full PBR maps and materials are untouched in the individual assets.
const compositionMaterials=new WeakMap();
function matteMaterial(m){
  if(compositionMaterials.has(m))return compositionMaterials.get(m);
  const simplified=new T.MeshLambertMaterial({color:m.color,map:m.map,alphaMap:m.alphaMap,
      vertexColors:m.vertexColors,side:m.side,opacity:m.opacity,transparent:m.transparent,alphaTest:m.alphaTest});
  compositionMaterials.set(m,simplified);
  return simplified;
}
const simplify=m=>Array.isArray(m)?m.map(matteMaterial):matteMaterial(m);
function installRepeated(scene,gltf,placements){
  const root=gltf.scene;
  const four=root.getObjectByName('CloverLeafFour');if(four)four.visible=false;
  root.updateMatrixWorld(true);
  const temp=new T.Object3D(), out=new T.Matrix4(), col=new T.Color();
  root.traverseVisible(mesh=>{
    if(!mesh.isMesh||mesh.isSkinnedMesh)return;
    const inst=new T.InstancedMesh(mesh.geometry,simplify(mesh.material),placements.length);
    for(let i=0;i<placements.length;i++){
      const [x,z,scale,yaw]=placements[i];temp.position.set(x,surface(x,z)-.007,z);
      temp.scale.setScalar(scale);temp.rotation.set(0,yaw,0);temp.updateMatrix();
      inst.setMatrixAt(i,out.multiplyMatrices(temp.matrix,mesh.matrixWorld));
      const shade=.87+(i%9)*.023;inst.setColorAt(i,col.setRGB(shade,shade,shade));
    }
    inst.computeBoundingSphere();scene.add(inst);
  });
}
const detailed=new Set(['broad-oak','citrus-swallowtail']);
const asset=id=>new URL(detailed.has(id)?`./scenes/meadow/${id}/model.glb`:`./scenes/meadow/lod/${id}.glb`,location.href).href;

async function openMeadow(){
  const proof=new URLSearchParams(location.search).has('capture');
  const renderer=new T.WebGLRenderer({antialias:true,powerPreference:'high-performance',preserveDrawingBuffer:proof});
  renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.NeutralToneMapping;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFShadowMap;
  renderer.domElement.setAttribute('aria-label','可旋转的实时三维草甸');renderer.domElement.tabIndex=0;
  stage.prepend(renderer.domElement);
  const scene=new T.Scene(),camera=new T.PerspectiveCamera(43,1,.055,380);
  scene.fog=new T.FogExp2(0xded8c6,.013);
  scene.add(makeTerrain(),makeSward(),makeSky(),new T.HemisphereLight(0xf3f5e9,0x9a8d5e,2.05));
  const sun=new T.DirectionalLight(0xffe2b7,2.65);
  sun.position.set(20,20,-22);sun.target.position.set(6,0,-9);
  sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);
  sun.shadow.autoUpdate=false;sun.shadow.needsUpdate=true;
  const sc=sun.shadow.camera;sc.left=-21;sc.right=21;sc.top=20;sc.bottom=-20;sc.far=58;
  sun.shadow.bias=-.00034;sun.shadow.normalBias=.09;sun.shadow.radius=3;
  scene.add(sun,sun.target);
  const ctl=new OrbitControls(camera,renderer.domElement);
  ctl.enablePan=false;ctl.enableDamping=true;ctl.dampingFactor=.09;ctl.minDistance=.6;ctl.maxDistance=33;
  ctl.minPolarAngle=.66;ctl.maxPolarAngle=Math.PI/2-.015;
  ctl.minAzimuthAngle=-.7;ctl.maxAzimuthAngle=.8;
  let moving=!matchMedia('(prefers-reduced-motion: reduce)').matches;
  let pose='overview', raf=0, clock=0, last=0;
  const view=(id)=>{
    pose=id;
    if(id==='detail'){
      camera.fov=39;camera.position.set(-1.7,surface(-1.7,11.6)+ .36,11.6);ctl.target.set(-2.44,surface(-2.44,10.5)+.13,10.5);
    }else{
      camera.fov=camera.aspect<.9?55:43;camera.position.set(-2.7,surface(-2.7,14)+1.03,14);const lateral=camera.aspect<.9?3.0:1.2;ctl.target.set(lateral,surface(lateral,-12)+.59,-12);
    }
    camera.updateProjectionMatrix();ctl.update();mark();
    for(const btn of document.querySelectorAll('[data-meadow-view]'))btn.setAttribute('aria-pressed',String(btn.dataset.meadowView===id));
  };
  const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  let loaded=0;
  const models=Object.fromEntries(await Promise.all(meadowAssets.map(async({id})=>{
    const model=await loader.loadAsync(asset(id));status.textContent=`正在铺设草甸 · ${++loaded} / ${meadowAssets.length}`;
    return [id,model];
  })));
  const distribution={
    'bermuda-grass':[...spread(45,10,10,.64),...generateClusters(-3.6,10.0,19,1.5)],
    'fine-fescue':[...spread(51,19,47,.2),...generateClusters(-4.2,10.4,14,1.4,1.12),...generateClusters(2.5,9.2,9,1.25)],
    'green-foxtail':[...spread(31,19,40,.20),...generateClusters(-4.7,9,8,1.1,.99)],
    'white-clover':[...generateClusters(-2.5,10,15,1.15),...generateClusters(3.3,7.7,9,1.08),...generateClusters(2.9,.6,7,1.2)],
    'common-daisy':[...generateClusters(-3.24,9.9,8,.8),...generateClusters(2.7,5.2,8,.85),...generateClusters(-4.1,-.8,6,.9)],
    'persian-speedwell':[...generateClusters(-2.25,10.75,16,.86),...generateClusters(3.38,7.3,7,.64)],
    'self-heal':[...generateClusters(-3.8,10,8,.65),...generateClusters(3.1,2.2,6,.65)],
    'field-poppy':[[3.5,6.3,1.03,1.1],[3.86,5.94,.82,2.4],[3.55,5.6,.78,.2]]
  };
  for(const [id,p] of Object.entries(distribution))installRepeated(scene,models[id],p);
  const oak=models['broad-oak'].scene;
  oak.position.set(8.5,surface(8.5,-9.8)-.09,-9.8);
  oak.rotation.y=-.13;
  oak.traverse(o=>{if(o.isMesh){o.material=simplify(o.material);o.castShadow=true;}});
  scene.add(oak);
  const moth=models['citrus-swallowtail'];
  const insect=moth.scene,mixer=moth.animations.length?new T.AnimationMixer(insect):null;
  if(mixer)mixer.clipAction(moth.animations[0]).play();
  insect.traverse(o=>{if(o.isMesh)o.material=simplify(o.material);});
  scene.add(insect);
  const move=(t,dt)=>{
    const x=-2.85+Math.sin(t*.63)*.81,z=9.9+Math.sin(t*.47+.5)*.68;
    insect.position.set(x,surface(x,z)+.21+Math.sin(t*2.25)*.065,z);
    insect.rotation.y=1.25+Math.sin(t*.63+.9)*.9;
    insect.rotation.z=Math.sin(t*1.7)*.14;
    if(dt)mixer?.update(dt);
  };
  move(0,0);
  function mark(){if(!raf&&!document.hidden)raf=requestAnimationFrame(draw);}
  function draw(now){
    raf=0;
    const dt=last?Math.min(.06,(now-last)/1000):0;last=now;
    if(moving){clock+=dt;move(clock,dt);}
    ctl.update();renderer.render(scene,camera);
    if(!stage.dataset.rendered){
      stage.dataset.rendered='true';
      stage.dataset.triangles=String(renderer.info.render.triangles);
    }
    if(moving)mark();
  }
  function resize(){
    const w=stage.clientWidth,h=stage.clientHeight;if(!w||!h)return;
    const smallBefore=camera.aspect<.9;camera.aspect=w/h;
    if(smallBefore!==(camera.aspect<.9))view(pose);
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.25,1380/Math.max(w,h)));
    renderer.setSize(w,h,false);
    renderer.domElement.style.width='100%';renderer.domElement.style.height='100%';mark();
  }
  new ResizeObserver(resize).observe(stage);
  ctl.addEventListener('change',mark);
  stage.addEventListener('keydown',e=>{
    if(e.target!==renderer.domElement)return;
    const viewKeys={Home:()=>view('overview'),ArrowLeft:()=>ctl.rotateLeft(.075),ArrowRight:()=>ctl.rotateLeft(-.075),ArrowUp:()=>ctl.rotateUp(.065),ArrowDown:()=>ctl.rotateUp(-.065)};
    if(viewKeys[e.key]){e.preventDefault();viewKeys[e.key]();mark();}
  });
  for(const btn of document.querySelectorAll('[data-meadow-view]'))btn.addEventListener('click',()=>view(btn.dataset.meadowView));
  const motion=$('meadow-motion');
  function syncMotion(){motion.textContent=moving?'暂停凤蝶':'播放凤蝶';motion.setAttribute('aria-pressed',String(moving));}
  syncMotion();motion.addEventListener('click',()=>{moving=!moving;last=0;syncMotion();mark();});
  document.addEventListener('visibilitychange',()=>{cancelAnimationFrame(raf);raf=0;last=0;mark();});
  renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();moving=false;cancelAnimationFrame(raf);status.hidden=false;status.textContent='图形连接中断。请刷新后重试。';});
  view(pose);resize();status.hidden=true;$('meadow-controls').hidden=false;
}
openMeadow().catch(e=>{console.error(e);status.textContent='草甸未加载完成。请联网刷新，或前往资产库查看可离线的单体预览。';});
