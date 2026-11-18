import { MathUtils, Vector3 } from 'three';
import { createFeedingDrive } from '../fish/arowana/feeding-drive.js';
import { TURN_RESPONSE_HISTORY } from '../fish/arowana/turn-response.js';
import { cruiseAcceleration, roundSwimJunction } from './feeding-curve.js';

const UP = new Vector3(0, 1, 0);
const STRAIGHT = new Vector3();
const CIRCLE = 2 * Math.PI;
const { euclideanModulo: wrap, lerp, smoothstep } = MathUtils;

function turnAngle(from, to, sign) {
  const yaw = Math.atan2(from.z * to.x - from.x * to.z, from.dot(to));
  return Math.abs(yaw) < 1e-7 ? 0 : wrap(sign * yaw, CIRCLE);
}

// Join two turning circles with a common tangent in the horizontal plane.
// Every candidate advances along the fish's heading at a bounded turn radius.
function arcLeg(from, heading, to, tangent, radius, firstTurn, lastTurn, merging, verticalRampScale) {
  const initial = heading.clone().setY(0).normalize();
  const final = tangent.clone().setY(0).normalize();
  const startCenter = from.clone().setY(0).addScaledVector(
    new Vector3(initial.z, 0, -initial.x), firstTurn * radius);
  const endCenter = to.clone().setY(0).addScaledVector(
    new Vector3(final.z, 0, -final.x), lastTurn * radius);
  const between = endCenter.clone().sub(startCenter);
  const gap = between.length();
  const spacing = (firstTurn - lastTurn) * radius;
  if (gap <= Math.max(1e-6, Math.abs(spacing))) return;

  const line = between.divideScalar(gap).applyAxisAngle(UP, Math.asin(spacing / gap));
  const firstLength = turnAngle(initial, line, firstTurn) * radius;
  const lineLength = Math.sqrt(gap * gap - spacing * spacing);
  const lastLength = turnAngle(line, final, lastTurn) * radius;
  const lineEnd = firstLength + lineLength;
  const length = lineEnd + lastLength;
  const lineStart = startCenter.clone().addScaledVector(new Vector3(-line.z, 0, line.x),
    firstTurn * radius);
  const baseRamp = merging ? Math.min(.42 * length, .85 * radius) : Math.min(.25 * length, .52 * radius);
  const ramp = Math.min(.46 * length, baseRamp * verticalRampScale);
  const rampEnd = length - ramp;
  const startSlope = heading.y / Math.hypot(heading.x, heading.z);
  const endSlope = tangent.y / Math.hypot(tangent.x, tangent.z);
  const slope = (to.y - from.y - .5 * ramp * (startSlope + endSlope)) / rampEnd;

  function rampHeight(distance, edgeSlope) {
    const t = distance / ramp;
    return distance * edgeSlope + ramp * (slope - edgeSlope) * t ** 3 * (1 - .5 * t);
  }

  function frame(distance, point, direction, acceleration) {
    let bend = 0;
    if (distance < firstLength) {
      direction.copy(initial).applyAxisAngle(UP, firstTurn * distance / radius);
      point.set(-direction.z, 0, direction.x).multiplyScalar(firstTurn * radius).add(startCenter);
      bend = firstTurn / radius;
    } else if (distance < lineEnd) {
      direction.copy(line);
      point.copy(lineStart).addScaledVector(line, distance - firstLength);
    } else {
      const along = distance - lineEnd;
      direction.copy(line).applyAxisAngle(UP, lastTurn * along / radius);
      point.set(-direction.z, 0, direction.x).multiplyScalar(lastTurn * radius).add(endCenter);
      bend = lastLength > 1e-6 ? lastTurn / radius : 0;
    }
    acceleration.set(direction.z * bend, 0, -direction.x * bend);
    if (distance < ramp) {
      const t = distance / ramp;
      point.y = from.y + rampHeight(distance, startSlope);
      direction.y = lerp(startSlope, slope, smoothstep(distance, 0, ramp));
      acceleration.y = 6 * t * (1 - t) * (slope - startSlope) / ramp;
    } else if (distance > rampEnd) {
      const remaining = length - distance;
      const t = remaining / ramp;
      point.y = to.y - rampHeight(remaining, endSlope);
      direction.y = lerp(endSlope, slope, smoothstep(remaining, 0, ramp));
      acceleration.y = -6 * t * (1 - t) * (slope - endSlope) / ramp;
    } else {
      point.y = from.y + .5 * ramp * (startSlope + slope) + (distance - ramp) * slope;
      direction.y = slope;
    }
  }

  const acceleration = new Vector3();
  let junctions = [];
  function sample(distance, point, direction) {
    const junction = junctions.find(part => distance >= part.start && distance <= part.end);
    if (junction) junction.sample(distance, point, direction, acceleration);
    else frame(distance, point, direction, acceleration);
    const horizontalSpeed = Math.hypot(direction.x, direction.z);
    const bend = (direction.z * acceleration.x - direction.x * acceleration.z) / horizontalSpeed ** 3;
    direction.normalize();
    return bend;
  }

  function round(entry, exit) {
    const width = Math.min(.44 * radius, .46 * length);
    const spans = [];
    for (const knot of [0, firstLength, lineEnd, length]) {
      const start = Math.max(0, knot - width);
      const end = Math.min(length, knot + width);
      const previous = spans.at(-1);
      // Round neighbouring junctions together when a leg between them is short.
      if (previous && start <= previous.end) previous.end = end;
      else spans.push({ start, end });
    }
    junctions = spans.map(({ start, end }) =>
      roundSwimJunction(frame, start, end, start === 0 ? entry : undefined, end === length ? exit : undefined));
  }

  return { length, sample, round, exitBend: lastLength > 1e-6 ? lastTurn / radius : 0 };
}

function outOfBounds({ x, y, z }) {
  return Math.max(0, Math.abs(x) - 3.28) + Math.max(0, y - 1.66, -1.68 - y)
    + Math.max(0, z - 1.6, -2.25 - z);
}

function bestLeg(from, heading, to, tangent, radius, budget, { matrix, scale, verticalRampScale }, mergeBend) {
  const point = new Vector3();
  const direction = new Vector3();
  const gradeLimit = Math.max(.49, Math.abs(heading.y), Math.abs(tangent.y)) + .01;
  let best;
  for (const first of [-1, 1]) {
    for (const last of [-1, 1]) {
      const leg = arcLeg(from, heading, to, tangent, radius, first, last, mergeBend !== undefined, verticalRampScale);
      if (!leg) continue;
      const length = leg.length * scale;
      if (best && length >= best.score) continue;
      let bounds = 0;
      let steepest = 0;
      for (let index = 0; index <= 20; index++) {
        leg.sample(leg.length * index / 20, point, direction);
        bounds += outOfBounds(point.applyMatrix4(matrix)) / 21;
        steepest = Math.max(steepest, Math.abs(direction.y));
      }
      const surge = Math.max(0, length - budget);
      const steepness = 9 * Math.max(0, steepest - .31) ** 2
        + 225 * Math.max(0, steepest - gradeLimit) ** 2;
      const bending = mergeBend === undefined ? 0 : 1.05 * Math.abs(leg.exitBend - mergeBend) / scale;
      const score = length + 28 * bounds + steepness + 10 * surge ** 2 + bending;
      if (!best || score < best.score) best = { ...leg, score };
    }
  }
  return best;
}

// A timed cubic in arc length matches the speed of the adjoining motions.
function travel(elapsed, duration, length, entrySpeed, exitSpeed, out) {
  const t = elapsed / duration;
  const u = 1 - t;
  const a = Math.min(entrySpeed * duration, 2.5 * length);
  const b = Math.min(exitSpeed * duration, 2.5 * length);
  out.distance = a * t * u * u + length * t * t * (3 - 2 * t) - b * t * t * u;
  out.speed = (a * u * (1 - 3 * t) + 6 * length * t * u + b * t * (3 * t - 2)) / duration;
}

export function planFeedingSwim(fish, food, launch, {
  delay = 0, speed, turnRadius, tailDrive = false, cruiseOffset = 0,
}) {
  const { object, route, sampleCruise, mouthOffset, trail } = fish;
  const { parent } = object;
  parent.updateWorldMatrix(true, false);
  const scale = parent.matrixWorld.getMaxScaleOnAxis();
  const space = { matrix: parent.matrixWorld, scale, verticalRampScale: fish.verticalRampScale ?? 1 };
  const radius = turnRadius / scale;
  const runIn = Math.min(.36, .25 / scale);
  const runOut = Math.max(.30 / scale, (fish.lead ?? 0) + .10);

  const target = parent.worldToLocal(food.clone());
  const point = new Vector3();
  const candidates = [];
  for (const wait of [0, .75, 1.7]) {
    const start = launch + delay + wait;
    const startPace = {};
    sampleCruise(start + cruiseOffset, startPace);
    const from = new Vector3();
    const heading = new Vector3();
    route.sample(startPace.distance, from, heading);
    const bearing = target.clone().sub(from).setY(0);
    if (bearing.lengthSq() < .001) bearing.copy(heading).setY(0);
    bearing.normalize();
    for (let index = 0; index < 12; index++) {
      const aim = bearing.clone().applyAxisAngle(UP, CIRCLE * index / 12);
      const bite = target.clone().addScaledVector(aim, -mouthOffset.x);
      bite.y -= mouthOffset.y;
      const approachEnd = bite.clone().addScaledVector(aim, -runIn);
      const exitStart = bite.clone().addScaledVector(aim, runOut);
      const clearance = 15 * outOfBounds(point.copy(exitStart).applyMatrix4(space.matrix));
      const curve = bestLeg(from, heading, approachEnd, aim, radius, Infinity, space);
      if (!curve) continue;
      const biteDistance = curve.length + runIn;
      const approachTime = Math.max(.85, .12 + scale * biteDistance / speed);
      const biteTime = start + approachTime;
      const score = curve.score + clearance + 1.25 * wait;
      candidates.push({ curve, aim, approachEnd, exitStart, startPace, start, heading,
        biteDistance, approachTime, biteTime, score });
    }
  }

  candidates.sort((a, b) => a.score - b.score);
  let attack;
  let exit;
  function joinAt(time) {
    const pace = {};
    sampleCruise(time, pace);
    const point = new Vector3();
    const heading = new Vector3();
    const bend = route.sample(pace.distance, point, heading);
    return { pace, point, heading, bend, time };
  }

  // A lone arowana can merge into any point on its loop. A school keeps the
  // same playback phase for all members so they regain their formation.
  const nearbyJoins = tailDrive && Array.from({ length: 32 }, (_, index) =>
    joinAt(launch + cruiseOffset + index * fish.duration / 32));
  const returnTimes = [1.6, 2.1, 2.7, 3.4, 4.2, 5.1, 6.2, 7.6, 9];
  for (const candidate of candidates.slice(0, 8)) {
    const joins = nearbyJoins || returnTimes.map(seconds =>
      ({ ...joinAt(candidate.biteTime + seconds + cruiseOffset), seconds }));
    for (const join of joins) {
      const room = nearbyJoins ? Infinity : speed * join.seconds - runOut * scale;
      const curve = bestLeg(candidate.exitStart, candidate.aim, join.point, join.heading,
        radius, room, space, nearbyJoins ? join.bend : undefined);
      if (!curve) continue;
      const seconds = join.seconds ?? Math.max(1.48, (curve.length + runOut) * scale / (.73 * speed) + .17);
      const score = candidate.score + .55 * curve.score + .59 * seconds;
      if (!exit || score < exit.score) {
        attack = candidate;
        exit = { curve, join, seconds, score };
      }
    }
  }
  if (!attack) return;
  const { biteDistance, approachTime, biteTime, start, startPace } = attack;

  const exitTime = biteTime + exit.seconds;
  const resumeOffset = nearbyJoins
    ? wrap(exit.join.time - exitTime + fish.duration / 2, fish.duration) - fish.duration / 2
    : cruiseOffset;
  const straightEnd = biteDistance + runOut;
  const length = straightEnd + exit.curve.length;
  const { pace: exitPace, heading: exitHeading } = exit.join;
  attack.curve.round(cruiseAcceleration(route, startPace.distance), STRAIGHT);
  exit.curve.round(STRAIGHT, cruiseAcceleration(route, exitPace.distance));
  const entrySpeed = startPace.speed * Math.hypot(attack.heading.x, attack.heading.z);
  const exitSpeed = exitPace.speed * Math.hypot(exitHeading.x, exitHeading.z);
  const biteSpeed = .68 * Math.min(speed / scale, biteDistance / approachTime, (length - biteDistance) / exit.seconds);
  const drive = tailDrive && createFeedingDrive(
    { length: biteDistance, duration: approachTime, entrySpeed, exitSpeed: biteSpeed },
    { length: length - biteDistance, duration: exit.seconds, entrySpeed: biteSpeed, exitSpeed },
    startPace.phase, exitPace.phase,
  );
  const cruise = {};
  const historyCruise = {};
  const swim = {
    distance: 0, speed: 0, effort: 0, spineFlex: 0, tail: undefined, pace: cruise, sample,
    samplePace: (time, out) => move(time, out, historyCruise, false),
  };
  const cruisePoint = new Vector3();
  const cruiseTangent = new Vector3();
  let lookAheadBlend = 1;

  // Bones sample beyond the head or behind the body. Keep both ends joined
  // to the original route while the full fish crosses the detour.
  function sample(distance, point, tangent) {
    if (distance < 0) return route.sample(startPace.distance + distance, point, tangent);
    if (distance >= length) return route.sample(exitPace.distance + distance - length, point, tangent);
    const bend = sampleDetour(distance, point, tangent);
    if (lookAheadBlend === 1) return bend;
    const priorBend = route.sample(startPace.distance + distance, cruisePoint, cruiseTangent);
    point.lerp(cruisePoint, 1 - lookAheadBlend);
    tangent.lerp(cruiseTangent, 1 - lookAheadBlend).normalize();
    return lerp(priorBend, bend, lookAheadBlend);
  }

  function sampleDetour(distance, point, tangent) {
    if (distance < attack.curve.length) return attack.curve.sample(distance, point, tangent);
    if (distance < straightEnd) {
      point.copy(attack.approachEnd).addScaledVector(attack.aim, distance - attack.curve.length);
      tangent.copy(attack.aim);
      return 0;
    }
    return exit.curve.sample(distance - straightEnd, point, tangent);
  }

  function move(time, out, base, withPose) {
    sampleCruise(time + (time < biteTime ? cruiseOffset : resumeOffset), base);
    if (time < start) {
      out.distance = -wrap(startPace.distance - base.distance, route.length);
      out.speed = base.speed;
    } else if (drive && time < exitTime) {
      drive(time - start, out, withPose);
    } else if (time < biteTime) {
      travel(time - start, approachTime, biteDistance, entrySpeed, biteSpeed, out);
    } else if (time < exitTime) {
      travel(time - biteTime, exit.seconds, length - biteDistance, biteSpeed, exitSpeed, out);
      out.distance += biteDistance;
    } else {
      const traveled = wrap(base.distance - exitPace.distance, route.length);
      const pastExit = traveled > route.length - 1e-8 ? 0 : traveled;
      out.distance = length + pastExit;
      out.speed = base.speed;
      return pastExit;
    }
    return 0;
  }

  function at(time) {
    lookAheadBlend = start > launch ? smoothstep(time, Math.max(launch, start - .58), start) : 1;
    swim.tail = undefined;
    const pastExit = move(time, swim, cruise, true);
    if (pastExit >= trail && (!tailDrive || time >= exitTime + TURN_RESPONSE_HISTORY)) return;
    const approach = swim.distance / biteDistance;
    swim.effort = .56 * smoothstep(approach, 0, .27) * (1 - smoothstep(approach, .58, 1))
      + .21 * smoothstep(swim.distance, biteDistance, straightEnd + .3 / scale)
      * (1 - smoothstep(swim.distance, straightEnd, length));
    swim.spineFlex = smoothstep(time, Math.max(launch, start - .24), start + .48)
      * (1 - smoothstep(swim.distance, length, length + trail));
    return swim;
  }

  return { biteTime, exitTime, resumeOffset, at };
}
