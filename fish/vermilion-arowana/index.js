import { createSwimmer } from './swim.js';

export const vermilionArowana = {
  id: 'vermilion-arowana',
  modelFile: './fish/vermilion-arowana/vermilion-arowana.glb',
  createSwimmer(object, route, motion) {
    const { map, normalMap } = object.getObjectByName('Body').material;
    map.anisotropy = 8;
    normalMap.anisotropy = 8;
    return createSwimmer(object, route, motion);
  },
};
