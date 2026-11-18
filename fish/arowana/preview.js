import { startFishPreview } from '../../src/fish-preview.js';
import { createArowanaPreviewRoute } from './cruise-route.js';
import { arowana } from './index.js';

const route = createArowanaPreviewRoute();

startFishPreview(arowana, route);
