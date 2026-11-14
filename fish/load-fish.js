import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';

export async function loadFish(species, bytes) {
  const { scene } = await new GLTFLoader().parseAsync(bytes, '');

  return function createInstance(route) {
    // Instances share geometry and textures. Each one has its own bones.
    const object = clone(scene);
    object.name = species.id;
    return { object, ...species.createSwimmer(object, route) };
  };
}
