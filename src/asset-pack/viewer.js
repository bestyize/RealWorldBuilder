import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createTankEnvironment } from '../environment.js';
import { takeEmbeddedModel } from '../embedded-data.js';
import { installBackground } from './background.js';

const $ = id => document.getElementById(id);

function installPanel(){
  const button=$('pack-toggle'), panel=$('panel');
  function set(open,restore=false){
    panel.hidden=!open;button.setAttribute('aria-expanded',String(open));
    button.title=open?'收起管理面板':'展开管理面板';button.setAttribute('aria-label',button.title);
    if(!open&&restore)button.focus();
  }
  button.disabled=false;
  button.addEventListener('click',()=>set(panel.hidden));
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!panel.hidden)set(false,true);});
}

export async function openAsset(asset, adapter){
  const stage=$('stage'), status=$('status');
  try{
    const renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,premultipliedAlpha:true,powerPreference:'high-performance'});
    renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.toneMapping=THREE.NeutralToneMapping;
    renderer.setClearColor(0x000000,0);
    const canvas=renderer.domElement;
    canvas.setAttribute('aria-label',asset.name+'。方向键旋转，加减键缩放，Home 重置视角。');
    canvas.tabIndex=0;stage.prepend(canvas);
    const scene=new THREE.Scene();scene.background=null;
    scene.environment=adapter.environment?.(renderer)??createTankEnvironment(renderer);
    scene.environmentIntensity=adapter.environmentIntensity??.71;
    const key=new THREE.DirectionalLight(0xfff5e6,adapter.keyIntensity??2.05);key.position.set(-3.8,4.4,3.0);
    const rim=new THREE.DirectionalLight(0xe2eeff,.88);rim.position.set(2,4.2,-4.1);
    const fill=new THREE.DirectionalLight(0xf2fbff,.60);fill.position.set(3.2,.5,4.8);
    scene.add(key,fill,rim,new THREE.HemisphereLight(0xf9f6e5,0xa4a79a,.64));
    installBackground(asset.backgrounds);
    const subject=await adapter.create(takeEmbeddedModel(),{renderer,asset});
    scene.add(subject.object);
    const hasAnimation=Number.isFinite(subject.duration)&&subject.duration>0&&typeof subject.update==='function';
    const modeBox=$('pack-mode');
    const modes=subject.modes??adapter.modes??[];
    if(modes.length>1){
      $('modes').hidden=false;$('mode-label').textContent=asset.modeLabel??'展示';
      for(const {id,label} of modes)modeBox.add(new Option(label,id));
      modeBox.value=subject.defaultMode??modes[0].id;
    }
    const camera=new THREE.PerspectiveCamera(30,1,.002,140);
    const ctl=new OrbitControls(camera,canvas);ctl.enablePan=false;ctl.enableDamping=false;
    ctl.minPolarAngle=.035;ctl.maxPolarAngle=Math.PI-.035;
    const size=new THREE.Vector3(),center=new THREE.Vector3(), direction=new THREE.Vector3();
    let animation=hasAnimation&&!matchMedia('(prefers-reduced-motion: reduce)').matches;
    let time=0,mark=0,raf=0,lost=false,anchored=false;
    const anchor=new THREE.Vector3(),delta=new THREE.Vector3();
    function motionCenter(){return modeBox.value==='school'?null:subject.getMotion?.().center;}
    const step=t=>{
      if(!hasAnimation)return;
      subject.update(t);
      const now=motionCenter();
      if(!now)return;
      if(anchored){
        delta.subVectors(now,anchor);
        ctl.target.add(delta);camera.position.add(delta);ctl.update();
      }
      anchor.copy(now);
    };
    function markControls(){
      if(!hasAnimation)return;
      $('pack-seek').value=String(time);
      $('pack-time').textContent=`${time.toFixed(1)} / ${subject.duration.toFixed(1)} 秒`;
      $('pack-play').textContent=animation?'暂停':'播放';
    }
    function redraw(){
      if(raf||lost||document.hidden)return;
      raf=requestAnimationFrame(now=>{
        raf=0;
        if(animation&&hasAnimation){
          if(mark)time=(time+Math.min(.10,(now-mark)/1000))%subject.duration;
          step(time);mark=now;markControls();
        }
        renderer.render(scene,camera);
        if(animation&&hasAnimation)redraw();
      });
    }
    function reset(near=false){
      const a=stage.clientWidth/Math.max(1,stage.clientHeight);
      const visible=subject.getFocus?.()??subject.object;
      const box=new THREE.Box3().setFromObject(visible,true);
      if(box.isEmpty()){center.set(0,0,0);size.set(1,1,1);}
      else{box.getCenter(center);box.getSize(size);}
      if(subject.cameraCenter)center.copy(subject.cameraCenter);
      const hints=typeof adapter.camera==='function'?adapter.camera(modeBox.value):adapter.camera??{};
      if(hints.center)center.fromArray(hints.center);
      if(hints.targetOffset)center.add(new THREE.Vector3().fromArray(hints.targetOffset));
      direction.fromArray(hints.direction??(hasAnimation?[.10,.14,1]:[.42,.36,1])).normalize();
      // Conservative framing when viewed by touch devices, wide fins or long tail bends.
      const fit=Math.max(size.y,size.x/Math.max(.24,a),.24)/(2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2)));
      const isSchool=modeBox.value==='school';
      const idleDistance=(hints.distance??0)*(isSchool||!hasAnimation?1:.66);
      let distance=Math.max(fit*1.28+size.z*.5,idleDistance);
      if(near)distance*=.63;
      ctl.minDistance=Math.max(.008,distance*.25);ctl.maxDistance=Math.max(distance*3.2,2);
      camera.near=Math.max(distance/600,.001);camera.far=Math.max(distance*7,20);
      camera.position.copy(center).addScaledVector(direction,distance);
      camera.updateProjectionMatrix();ctl.target.copy(center);ctl.update();
      const now=motionCenter();anchored=!!now;if(now)anchor.copy(now);
      redraw();
    }
    function resize(){
      const w=stage.clientWidth,h=stage.clientHeight;
      if(!w||!h||lost)return;
      camera.aspect=w/h;
      renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.75,2100/Math.max(w,h)));
      renderer.setSize(w,h,false);reset();
    }
    function setAnimation(next){
      animation=next;mark=0;markControls();redraw();
    }
    ctl.addEventListener('change',redraw);
    if(hasAnimation){
      $('transport').hidden=false;$('pack-seek').max=String(subject.duration);
      $('pack-play').addEventListener('click',()=>setAnimation(!animation));
      $('pack-seek').addEventListener('input',e=>{time=Number(e.target.value);step(time);setAnimation(false);});
    }
    modeBox.addEventListener('change',()=>{
      anchored=false;subject.setMode?.(modeBox.value,time);
      if(hasAnimation){time%=subject.duration;step(time);$('pack-seek').max=String(subject.duration);}
      markControls();reset();
    });
    $('pack-reset').addEventListener('click',()=>reset());
    $('pack-near').addEventListener('click',()=>reset(true));
    const fullscreen=$('pack-fullscreen');
    if(document.documentElement.requestFullscreen&&document.fullscreenEnabled){
      fullscreen.hidden=false;fullscreen.addEventListener('click',async()=>{
        try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{}
      });
      document.addEventListener('fullscreenchange',()=>{fullscreen.textContent=document.fullscreenElement?'退出全屏':'全屏';});
    }
    canvas.addEventListener('keydown',e=>{
      if(e.ctrlKey||e.metaKey||e.altKey)return;
      const keys={ArrowLeft:()=>ctl.rotateLeft(.13),ArrowRight:()=>ctl.rotateLeft(-.13),ArrowUp:()=>ctl.rotateUp(.12),ArrowDown:()=>ctl.rotateUp(-.12),'+':()=>ctl.dollyIn(.85),'=':()=>ctl.dollyIn(.85),'-':()=>ctl.dollyOut(.85),Home:()=>reset()};
      if(keys[e.key]){e.preventDefault();keys[e.key]();redraw();}
    });
    document.addEventListener('visibilitychange',()=>{cancelAnimationFrame(raf);raf=0;mark=0;redraw();});
    canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();lost=true;status.hidden=false;status.textContent='图形连接中断，请重新打开。';});
    step(0);markControls();installPanel();
    new ResizeObserver(resize).observe(stage);
    resize();status.hidden=true;
  }catch(e){console.error(e);status.textContent='无法打开模型，请使用支持 WebGL 的浏览器。';}
}
