import { createArowanaCruiseWaypoints } from '../fish/arowana/cruise-route.js';
import { createSwimRoute } from '../fish/swim-route.js';

const eight = createArowanaCruiseWaypoints({
  halfWidth: 2.90, halfDepth: 1.25, centerY: .31, centerZ: -.35,
});

// Both laps share the approach and departure of the rear-right pass.
// Keeping those guide points preserves the original figure eight at both joins.
const join = 4;
const figureEight = [...eight.slice(join), ...eight.slice(0, join)];
const perimeter = [
  ...eight.slice(join, 13),
  [1.58, .205, 1.02],
  [1.02, .196, 1.09],
  [.44, .193, 1.11],
  [-.15, .204, 1.09],
  [-.74, .226, 1.04],
  [-1.32, .257, .95],
  [-1.88, .295, .83],
  [-2.36, .338, .62],
  [-2.74, .371, .31],
  [-2.97, .395, -.10],
  [-3.01, .415, -.55],
  [-2.77, .432, -.97],
  [-2.36, .444, -1.25],
  [-1.84, .452, -1.37],
  [-1.28, .456, -1.38],
  [-.69, .461, -1.30],
  [-.10, .465, -1.14],
  [.52, .466, -1.02],
  ...eight.slice(join - 2, join),
];

export const cruiseRoute = createSwimRoute([...figureEight, ...perimeter]);
export const vermilionCruiseDuration = 64;
