import { createSwimRoute } from '../swim-route.js';

export function createArowanaCruiseWaypoints({ halfWidth, halfDepth, centerY, centerZ = 0 }) {
  const count = 32;
  // The two lobes turn in opposite directions. Their crossing passes stay
  // at different heights, so the fish can swim cleanly through the middle.
  return Array.from({ length: count }, (_, i) => {
    const angle = 2 * Math.PI * i / count;
    const across = Math.sin(angle);
    return [
      halfWidth * across,
      centerY + .155 * Math.cos(angle) + .024 * across,
      centerZ - halfDepth * Math.sin(2 * angle),
    ];
  });
}

export function createArowanaCruiseRoute(options) {
  const waypoints = createArowanaCruiseWaypoints(options);
  return createSwimRoute(waypoints, .09 * waypoints.length);
}

export function createArowanaPreviewRoute() {
  return createArowanaCruiseRoute({ halfWidth: 2.78, halfDepth: 1.20, centerY: .08, centerZ: .04 });
}

export function createVermilionPreviewRoute() {
  return createArowanaCruiseRoute({ halfWidth: 3.22, halfDepth: 1.40, centerY: .12 });
}
