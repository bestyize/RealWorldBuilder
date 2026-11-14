import { startFishPreview } from '../../src/fish-preview.js';
import { createSwimRoute } from '../swim-route.js';
import { blueGuppy } from './index.js';

const route = createSwimRoute([
  [-1.58, -.03, .35], [-1.05, -.05, 1.05], [-.26, -.09, 1.33],
  [.63, .01, 1.2], [1.55, .18, .62], [1.70, .20, -.30],
  [1.26, .23, -.98], [.40, .19, -1.35], [-.52, .12, -1.33],
  [-1.42, .01, -.86], [-1.71, -.02, -.16],
], 2.85);

startFishPreview(blueGuppy, route);
