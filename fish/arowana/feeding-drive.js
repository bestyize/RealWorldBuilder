import { MathUtils } from 'three';

const TAU = 2 * Math.PI;
const { lerp, smoothstep } = MathUtils;

function timeLeg({ length, duration, entrySpeed, exitSpeed }, feeding) {
  const steps = Math.ceil(duration * 90);
  const dt = duration / steps;
  const edge = Math.min(.50, .22 * duration, .8 * length / (entrySpeed + exitSpeed));
  const kicks = Math.max(1, Math.round(duration / 2.45));
  const interval = duration / kicks;
  const effort = new Float64Array(steps + 1);
  const phase = new Float64Array(steps + 1);
  const edgeSpeed = new Float64Array(steps + 1);
  const waterSpeed = new Float64Array(steps + 1);
  const speed = new Float64Array(steps + 1);
  const distance = new Float64Array(steps + 1);
  let momentum = 0;
  let edgeDistance = 0;
  let waterDistance = 0;
  for (let i = 0; i <= steps; i++) {
    const time = i * dt;
    const stroke = time % interval;
    const start = feeding ? .04 : .20;
    const load = smoothstep(stroke, start, start + Math.min(.26, .27 * interval)) *
      (1 - smoothstep(stroke, .45 * interval, .73 * interval));
    const finish = smoothstep(duration - time, .12, Math.min(.86, .52 * interval));
    effort[i] = load * finish * (feeding ? (time < interval ? 1 : .68) : .54);
    if (i) {
      const load = .5 * (effort[i - 1] + effort[i]);
      momentum += dt * (1.85 * load - 1.48 * momentum);
      phase[i] = phase[i - 1] + TAU * dt * (.49 + .51 * load);
    }

    const entry = 1 - smoothstep(time, 0, edge);
    const exit = smoothstep(time, duration - edge, duration);
    edgeSpeed[i] = entry * entrySpeed + exit * exitSpeed;
    const settle = feeding ? 1 - .22 * smoothstep(time, Math.max(0, duration - .88), duration) : 1;
    waterSpeed[i] = (1 - entry - exit) * (.66 + .64 * momentum) * settle;
    if (i) {
      edgeDistance += .5 * dt * (edgeSpeed[i - 1] + edgeSpeed[i]);
      waterDistance += .5 * dt * (waterSpeed[i - 1] + waterSpeed[i]);
    }
  }

  // Match both endpoint speeds and the chosen route length. The middle of
  // the profile follows the tail strokes and the momentum left after them.
  const scale = (length - edgeDistance) / waterDistance;
  for (let i = 0; i <= steps; i++) {
    speed[i] = edgeSpeed[i] + scale * waterSpeed[i];
    if (i) distance[i] = distance[i - 1] + .5 * dt * (speed[i - 1] + speed[i]);
  }

  return {
    distance: length,
    phase: phase[steps],
    at(time, swim, tail) {
      const frame = time / dt;
      const i = Math.min(steps - 1, Math.floor(frame));
      const u = frame - i;
      swim.distance = distance[i] + dt * u * lerp(speed[i], speed[i + 1], .5 * u);
      swim.speed = lerp(speed[i], speed[i + 1], u);
      if (tail) tail.effort = lerp(effort[i], effort[i + 1], u);
      return lerp(phase[i], phase[i + 1], u);
    },
  };
}

export function createFeedingDrive(approach, departure, startPhase, endPhase) {
  const chase = timeLeg(approach, true);
  const turnAway = timeLeg(departure, false);
  const end = approach.duration + departure.duration;
  const travelPhase = chase.phase + turnAway.phase;
  const phaseScale = (endPhase - startPhase +
    TAU * Math.round((startPhase + travelPhase - endPhase) / TAU)) / travelPhase;
  const tail = { phase: 0, effort: 0, blend: 0, brake: 0 };

  return function sample(elapsed, swim, withPose = true) {
    const stroke = withPose ? tail : undefined;
    let phase;
    if (elapsed < approach.duration) {
      phase = chase.at(elapsed, swim, stroke);
    } else {
      phase = chase.phase + turnAway.at(elapsed - approach.duration, swim, stroke);
      swim.distance += chase.distance;
    }
    if (!stroke) return;
    tail.phase = startPhase + phaseScale * phase;
    tail.blend = smoothstep(elapsed, 0, .40) * (1 - smoothstep(elapsed, end - .58, end));
    const untilBite = approach.duration - elapsed;
    tail.brake = (1 - smoothstep(untilBite, .20, .79)) * smoothstep(untilBite, -.41, -.035);
    swim.tail = tail;
  };
}
