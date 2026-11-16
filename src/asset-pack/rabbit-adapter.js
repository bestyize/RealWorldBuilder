import { loadStaticModel } from './static-adapter.js';
import { addPlushVolume } from '../../objects/plush-rabbit/plush-volume.js';
import { createStudioEnvironment, STUDIO_WINDOW_POSITION } from '../../objects/plush-rabbit/studio.js';

export const rabbitAdapter={
 environment:renderer=>createStudioEnvironment(renderer).texture,environmentIntensity:.84,keyIntensity:1.36,
 async create(buffer,{renderer}){
   const object=await loadStaticModel(buffer);object.scale.setScalar(10);
   const aniso=Math.min(8,renderer.capabilities.getMaxAnisotropy());
   addPlushVolume(object,aniso,STUDIO_WINDOW_POSITION);
   return {object};
 }
};
