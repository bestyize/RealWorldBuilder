import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';

export async function loadFish(species, bytes) {
  const { scene } = await new GLTFLoader().parseAsync(bytes, '');

  return function createInstance(route, { scale = 1, ...motion } = {}) {
    // Share immutable assets. Each resident owns its skeletal pose.
    const object = clone(scene);
    object.name = species.id;
    object.scale.multiplyScalar(scale);
    return { object, ...species.createSwimmer(object, route, motion) };
  };
}
