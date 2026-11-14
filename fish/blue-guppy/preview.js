import { startFishPreview } from '../../src/fish-preview.js';
import { createSwimRoute } from '../swim-route.js';
import { blueGuppy } from './index.js';

const route = createSwimRoute([
  [-1.35, -.03, .35], [-.92, -.05, 1.05], [-.23, -.09, 1.33],
  [.56, .01, 1.2], [1.34, .18, .62], [1.47, .20, -.30],
  [1.10, .23, -.98], [.35, .19, -1.35], [-.45, .12, -1.33],
  [-1.24, .01, -.86], [-1.47, -.02, -.16],
], 2.85);

startFishPreview(blueGuppy, route);
