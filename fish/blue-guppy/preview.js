import { startFishPreview } from '../../src/fish-preview.js';
import { blueGuppy } from './index.js';
import { soloGuppyRoute } from './solo-route.js';

startFishPreview(blueGuppy, soloGuppyRoute, { cameraDistance: 12.0 });
