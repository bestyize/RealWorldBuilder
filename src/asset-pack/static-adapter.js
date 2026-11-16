import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { Vector3 } from 'three';

export async function loadStaticModel(buffer) {
  const {scene}=await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(buffer,'');
  return scene;
}

export const staticAdapter={
  async create(buffer,{renderer,asset}){
    const object=await loadStaticModel(buffer);
    // The variants are descendants of the one library root. Hide rather
    // than reload geometry/material; their independent exports stay at origin.
    const entries=(asset.variants??[]).map(v=>{
      const node=object.getObjectByName(v.node);
      if(!node)throw new Error('Variant missing: '+v.node);
      return {...v,node,position:node.position.clone()};
    });
    let selected=object;
    object.traverse(o=>{
      if(!o.isMesh)return;
      for(const m of Array.isArray(o.material)?o.material:[o.material])
        for(const t of [m.map,m.normalMap,m.roughnessMap])
          if(t)t.anisotropy=Math.min(renderer.capabilities.getMaxAnisotropy(),6);
    });
    return {object,getFocus:()=>selected,modes:entries.length?[{id:'all',label:'全部变体'},...entries]:[],
      setMode(id){
        for(const v of entries){
          v.node.visible=id==='all'||v.id===id;
          v.node.position.copy(id==='all'?v.position:new Vector3(0,0,0));
        }
        selected=entries.find(v=>v.id===id)?.node??object;
        object.updateMatrixWorld(true);
      }};
  }
};
