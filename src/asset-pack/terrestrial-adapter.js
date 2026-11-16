import { AnimationMixer, Box3, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

export const terrestrialAdapter={
  camera(mode){
    return {direction:mode==='dorsal'?[0,1,.04]:[.56,.40,1]};
  },
  async create(buffer,{renderer,asset}){
    const {scene:object,animations}=await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(buffer,'');
    // Normalize only on the inspection page. Keep the downloadable GLB in meters.
    const size=new Box3().setFromObject(object,true).getSize(new Vector3());
    const span=Math.max(size.x,size.y,size.z);
    if(span>0)object.scale.multiplyScalar(1/span);
    object.traverse(o=>{
      if(!o.isMesh)return;
      for(const m of Array.isArray(o.material)?o.material:[o.material]){
        for(const t of [m.map,m.normalMap,m.roughnessMap])if(t)t.anisotropy=Math.min(renderer.capabilities.getMaxAnisotropy(),8);
      }
    });
    if(asset.id==='white-clover'){
      const three=object.getObjectByName('CloverLeafThree'),four=object.getObjectByName('CloverLeafFour');
      if(!three||!four)throw new Error('Clover variant nodes unavailable');
      const setMode=id=>{three.visible=id!=='four';four.visible=id==='four';};
      setMode('three');
      return {object,modes:[{id:'three',label:'普通三出叶'},{id:'four',label:'四叶变体'}],defaultMode:'three',setMode};
    }
    if(asset.id==='citrus-swallowtail'){
      const clip=animations.find(a=>a.duration>0);
      if(!clip)return {object};
      const mixer=new AnimationMixer(object);
      mixer.clipAction(clip).play();
      // Let the viewer inspect the four wing joints without altering the game loop.
      const speed=.35;
      return {object,duration:clip.duration/speed,update:t=>mixer.setTime(t*speed),
        modes:[{id:'oblique',label:'立体观察'},{id:'dorsal',label:'俯看翅纹'}]};
    }
    return {object};
  }
};
