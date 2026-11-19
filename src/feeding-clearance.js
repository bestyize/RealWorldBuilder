import { Box3, MathUtils, Ray, Vector3 } from 'three';

const STEP = .10;
const OUTLINE_SPACING = .095;
const MOTION_MARGIN = .075;
const BYPASS_DIRECTIONS = [
  [0, 0, -1], [0, 0, 1], [-1, 0, 0], [1, 0, 0],
  [-.8, 0, -.6], [.8, 0, -.6], [-.8, 0, .6], [.8, 0, .6],
  [0, -.4, -.92], [0, -.4, .92], [-.92, -.4, 0], [.92, -.4, 0],
  [0, .32, -.95], [0, .32, .95],
];
const { clamp, smootherstep } = MathUtils;

function rampRate(time, start, end) {
  const u = clamp((time - start) / (end - start), 0, 1);
  return 30 * (u * (1 - u)) ** 2 / (end - start);
}

function swimFrame(fish, swim, time, point, heading, pace) {
  if (!swim) fish.sampleCruise(time, pace);
  const sample = swim?.sample ?? fish.route.sample;
  sample(swim?.distance ?? pace.distance, point, heading);
  return swim?.speed ?? pace.speed;
}

// Blend a short displacement into the path, with zero velocity at both ends.
// The derivative turns the fish along the resulting curve.
function bypassPath(fish, path, offset, launch, first, last, ramp) {
  const inStart = Math.max(launch, first - STEP - ramp);
  const inEnd = inStart + ramp;
  const outStart = Math.max(inEnd, last + STEP);
  const outEnd = outStart + ramp;
  const progress = time => smootherstep(time, inStart, inEnd) - smootherstep(time, outStart, outEnd);
  const point = new Vector3();
  const heading = new Vector3();
  const pace = {};
  const result = { distance: 0, speed: 0, sample(_, position, direction) {
    position.copy(point);
    direction.copy(heading);
  } };

  function at(time) {
    const swim = path?.at(time);
    const blend = progress(time);
    if (blend === 0 && (swim || time >= outEnd)) return swim;
    const speed = swimFrame(fish, swim, time, point, heading, pace);
    const change = rampRate(time, inStart, inEnd) - rampRate(time, outStart, outEnd);
    point.addScaledVector(offset, blend);
    heading.multiplyScalar(speed).addScaledVector(offset, change);
    result.speed = heading.length();
    heading.normalize();
    return result;
  }

  return { ...path, exitTime: Math.max(outEnd, path?.exitTime ?? launch), at };
}

// Sample the skinned outline in short sections so the clearance bends with
// the fish. Keep the fins separate from the body to leave room around them.
function outlineSections(object) {
  const sections = [];
  object.traverse(mesh => {
    if (!mesh.isSkinnedMesh) return;
    const positions = mesh.geometry.getAttribute('position');
    const cells = new Set();
    const bands = new Map();
    for (let i = 0; i < positions.count; i++) {
      const station = Math.floor(positions.getX(i) / OUTLINE_SPACING);
      const height = Math.floor(positions.getY(i) / OUTLINE_SPACING);
      const side = Math.floor(positions.getZ(i) / OUTLINE_SPACING);
      const cell = `${station},${height},${side}`;
      if (cells.has(cell)) continue;
      cells.add(cell);
      const band = Math.floor(station / 4);
      if (!bands.has(band)) bands.set(band, []);
      bands.get(band).push(i);
    }
    for (const vertices of bands.values()) sections.push({ mesh, vertices });
  });
  return sections;
}

export function createFeedingClearance(dragon, poseAt, launch, dangerUntil) {
  const sections = outlineSections(dragon.object);
  const frames = [];
  const vertex = new Vector3();

  function frameAt(step, time) {
    if (frames[step]) return frames[step];
    poseAt(time);
    dragon.object.updateMatrixWorld(true);
    const bounds = new Box3();
    const parts = sections.map(({ mesh, vertices }) => {
      const section = new Box3();
      for (const i of vertices) {
        mesh.getVertexPosition(i, vertex).applyMatrix4(mesh.matrixWorld);
        section.expandByPoint(vertex);
      }
      bounds.union(section);
      return section;
    });
    return (frames[step] = { bounds, parts });
  }

  return fish => {
    const space = fish.object.parent.matrixWorld;
    const scale = space.getMaxScaleOnAxis();
    const finReach = fish.clearanceRadius * scale;
    const side = .57 * finReach + MOTION_MARGIN;
    const margin = new Vector3(side, finReach + MOTION_MARGIN, side);
    const lengthSquared = ((fish.trail + fish.mouthOffset.x) * scale) ** 2;
    const point = new Vector3();
    const heading = new Vector3();
    const hit = new Vector3();
    const padded = new Box3();
    const ray = new Ray();
    const pace = {};
    const up = new Vector3();
    const lateral = new Vector3();
    const displacement = new Vector3();
    const prior = new Vector3();

    function overlaps(box) {
      padded.copy(box).expandByVector(margin);
      if (padded.containsPoint(ray.origin)) return true;
      return !!ray.intersectBox(padded, hit) && hit.distanceToSquared(ray.origin) <= lengthSquared;
    }

    function blockedAt(path, step) {
      const time = launch + step * STEP;
      swimFrame(fish, path?.at(time), time, point, heading, pace);
      heading.transformDirection(space);
      ray.set(point.applyMatrix4(space).addScaledVector(heading, -fish.trail * scale), heading);
      const { bounds, parts } = frameAt(step, time);
      return overlaps(bounds) && parts.some(overlaps);
    }

    function lastStep(path) {
      const end = Math.max(dangerUntil, path?.exitTime ?? launch);
      return Math.ceil((end - launch) / STEP);
    }

    function keepsClear(path) {
      const end = lastStep(path);
      for (let step = 1; step <= end; step++) {
        if (blockedAt(path, step)) return false;
      }
      return true;
    }

    function swimsSmoothly(path) {
      const halfStep = STEP / 2;
      const minimumDot = Math.cos(.31);
      const end = 2 * lastStep(path);
      swimFrame(fish, path.at(launch), launch, point, prior, pace);
      for (let i = 1; i <= end; i++) {
        const time = launch + i * halfStep;
        const speed = swimFrame(fish, path.at(time), time, point, heading, pace) * scale;
        const pitchChange = Math.abs(Math.asin(clamp(heading.y, -1, 1)) - Math.asin(clamp(prior.y, -1, 1)));
        if (speed > 2.2 || heading.dot(prior) < minimumDot || pitchChange > .13) return false;
        prior.copy(heading);
      }
      return true;
    }

    function bypass(path) {
      let first;
      let last;
      const end = lastStep(path);
      for (let step = 1; step <= end; step++) {
        if (!blockedAt(path, step)) continue;
        first ??= launch + step * STEP;
        last = launch + step * STEP;
      }
      if (first === undefined) return path;

      // Prefer a sideways pass. Use a longer, slower ramp when yielding on the cruise.
      for (const direction of BYPASS_DIRECTIONS) {
        for (const reach of [.32, .50, .69, .88, 1.08]) {
          displacement.fromArray(direction).multiplyScalar(reach / scale);
          for (const secondsPerUnit of path ? [2.8, 4.8] : [6.4, 4.8, 3.2]) {
            const ramp = Math.max(1.05, secondsPerUnit * reach);
            const detour = bypassPath(fish, path, displacement.clone(), launch, first, last, ramp);
            if (!keepsClear(detour) || !swimsSmoothly(detour)) continue;
            if (path) {
              const time = detour.biteTime;
              swimFrame(fish, detour.at(time), time, point, heading, pace);
              lateral.set(-heading.z, 0, heading.x).normalize();
              up.crossVectors(lateral, heading).normalize();
              detour.bitePoint = point.clone().addScaledVector(heading, fish.mouthOffset.x)
                .addScaledVector(up, fish.mouthOffset.y).applyMatrix4(space);
            }
            return detour;
          }
        }
      }
    }

    return { keepsClear, bypass };
  };
}
