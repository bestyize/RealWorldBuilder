import { startFishPreview } from '../../src/fish-preview.js';
import { createSwimRoute } from '../swim-route.js';
import { arowana } from './index.js';

const route = createSwimRoute([
  [-2.65, .03, .75], [-1.85, -.03, 1.22], [-.6, -.08, 1.38],
  [.7, -.05, 1.37], [1.9, .01, 1.14], [2.73, .05, .60],
  [2.89, .08, -.14], [2.52, .15, -.83], [1.63, .18, -1.14],
  [.42, .20, -1.25], [-.88, .17, -1.19], [-2.08, .12, -.95],
  [-2.78, .08, -.52], [-2.94, .04, .20],
], 3.6);

startFishPreview(arowana, route);
