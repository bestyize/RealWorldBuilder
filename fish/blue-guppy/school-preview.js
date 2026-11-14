import { Group } from 'three';
import { startFishPreview } from '../../src/fish-preview.js';
import { blueGuppy } from './index.js';
import { createGuppySchool } from './school.js';

startFishPreview(blueGuppy, null, {
  cameraDistance: 15.9,
  createSubjects: createFish => createGuppySchool(createFish, new Group()),
});
