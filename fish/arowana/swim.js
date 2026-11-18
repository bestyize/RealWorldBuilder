import * as THREE from 'three';
import { lowerIndex } from '../swim-route.js';
import { bindSwimMouth } from '../swim-mouth.js';
import { createContinuousBody, turnAcrossBody } from './continuous-body.js';
import { bindFeedingFace } from './feeding-face.js';
import { createTurnResponse } from './turn-response.js';

const TAU = 2 * Math.PI;
const X = new THREE.Vector3(1, 0, 0);
const Y = new THREE.Vector3(0, 1, 0);
const JOINTS = [
  'Head', 'Spine_1', 'Spine_2', 'Spine_3', 'Spine_4', 'Peduncle', 'Tail', 'Tail_Tip',
];

const wrap = THREE.MathUtils.euclideanModulo;
const lerp = THREE.MathUtils.lerp;
const mix = THREE.MathUtils.smoothstep;

function buildTiming(route) {
  let elapsed = 0;
  let cycles = 0;
  const samples = [];
  for (const [i, sample] of route.samples.entries()) {
    const angle = TAU * sample.distance / route.length;
    const turn = mix(Math.abs(sample.curvature), .20, 1.4);
    const effort = .48 + .29 * Math.sin(4 * angle - .75)
      + .15 * Math.sin(7 * angle + .55) + .08 * Math.cos(2 * angle + .8);
    const speed = .52 + .245 * effort - .105 * turn;
    const cadence = .56 + .54 * effort + .10 * turn;
    if (i) {
      const prior = samples[i - 1];
      const dt = 2 * (sample.distance - prior.distance) / (prior.speed + speed);
      elapsed += dt;
      cycles += .5 * dt * (prior.cadence + cadence);
    }
    samples.push({ ...sample, time: elapsed, cycles, speed, cadence, effort });
  }

  return {
    samples, duration: elapsed, cycles,
    startTime: samples[route.startIndex].time,
  };
}

function bindTransform(node, rootInverse) {
  const matrix = new THREE.Matrix4().multiplyMatrices(rootInverse, node.matrixWorld);
  const position = new THREE.Vector3();
  const rotation = new THREE.Quaternion();
  matrix.decompose(position, rotation, new THREE.Vector3());
  return { position, rotation };
}

function bindFin(scene, name, side, type, rootInverse) {
  const bone = scene.getObjectByName(name);
  if (!bone) return null;
  const inverseFrame = bindTransform(bone, rootInverse).rotation.invert();
  return {
    bone, side, type,
    sweep: Y.clone().applyQuaternion(inverseFrame),
    feather: X.clone().applyQuaternion(inverseFrame),
  };
}

/**
 * Animate a glTF rig with +X toward the nose, +Y up and +Z toward the front
 * of the aquarium. The caller provides the route and drives update in seconds.
 */
export function createSwimmer(scene, route) {
  const { samples, duration, cycles, startTime } = buildTiming(route);
  const wholeCycles = Math.round(cycles);
  scene.updateWorldMatrix(true, true);
  const rootInverse = scene.matrixWorld.clone().invert();
  const joints = JOINTS.map((name) => {
    const bone = scene.getObjectByName(name);
    if (!bone?.isBone) throw new Error(`Arowana skeleton is missing ${name}`);
    return {
      bone,
      position: bindTransform(bone, rootInverse).position,
      pose: new THREE.Quaternion(),
    };
  });

  const fins = ['Pectoral', 'Pelvic', 'Gill'].flatMap((type) => [
    bindFin(scene, `${type}_L`, 1, type, rootInverse),
    bindFin(scene, `${type}_R`, -1, type, rootInverse),
  ]).filter(Boolean);
  const body = createContinuousBody(scene, joints.map(joint => joint.bone), fins.map(fin => fin.bone), 1.08);
  const poseFace = bindFeedingFace(scene, joints[0].bone, {
    hinge: new THREE.Vector3(1.12, -.10, 0),
    corner: 1.151,
    lipHeight: x => -.138 + .217 * mix(x, 1.105, 1.425),
    angle: .253,
  });

  const distances = [0];
  const bodyScale = scene.scale.x;
  for (let i = 1; i < joints.length; i++) {
    distances.push(distances[i - 1] + bodyScale *
      joints[i].position.distanceTo(joints[i - 1].position));
  }
  // The trailing end of the fin continues beyond the final joint pivot.
  distances.push(distances.at(-1) + .23 * bodyScale);
  const length = distances.at(-1);
  const bend = createTurnResponse(joints.map((_, i) => distances[i] / distances.at(-2)), bodyScale, -.24);
  const points = distances.map(() => new THREE.Vector3());
  const curveTurns = distances.map(() => 0);
  const spineYaw = new Float64Array(distances.length);
  const previousTangent = new THREE.Vector3();
  const headTangent = new THREE.Vector3();
  const tangent = new THREE.Vector3();
  const bendPoint = new THREE.Vector3();
  const bendBefore = new THREE.Vector3();
  const bendAfter = new THREE.Vector3();
  const lateral = new THREE.Vector3();
  const forward = new THREE.Vector3();
  const up = new THREE.Vector3();
  const matrix = new THREE.Matrix4();
  const rootRotationInverse = new THREE.Quaternion();
  const axisRotation = new THREE.Quaternion();
  const motion = {
    head: new THREE.Vector3(), center: new THREE.Vector3(), heading: new THREE.Vector3(),
    turn: 0, speed: 0, phase: 0,
  };

  const mouth = bindSwimMouth(scene, joints[0].bone, 1.46, .037, joints[0].position);
  const cruise = {};

  function sampleCruise(timeSeconds, out) {
    const t = wrap(timeSeconds + startTime, duration);
    const index = lowerIndex(samples, 'time', t);
    const a = samples[index];
    const b = samples[index + 1];
    const u = (t - a.time) / (b.time - a.time);
    out.distance = lerp(a.distance, b.distance, u);
    out.effort = lerp(a.effort, b.effort, u);
    out.progress = t / duration;
    out.phase = TAU * wholeCycles * lerp(a.cycles, b.cycles, u) / cycles;
    out.speed = lerp(a.speed, b.speed, u);
  }

  function update(timeSeconds, swim) {
    sampleCruise(timeSeconds, cruise);
    const { progress } = cruise;
    const pace = swim?.pace ?? cruise;
    const tail = swim?.tail;
    const phase = tail?.phase ?? pace.phase;
    const distance = swim?.distance ?? cruise.distance;
    const sample = swim?.sample ?? route.sample;
    bend.update(swim?.cruiseTime ?? timeSeconds, sample, swim?.samplePace ?? sampleCruise);
    const effort = lerp(pace.effort, .24 + .76 * (tail?.effort ?? 0), tail?.blend ?? 0);
    const stroke = lerp(.58 + .74 * pace.effort, .17 + 1.03 * (tail?.effort ?? 0), tail?.blend ?? 0);
    const brake = tail?.brake ?? 0;
    const spineFlex = .74 * (swim?.spineFlex ?? 0);
    const finPhase = cruise.phase * Math.round(duration * 1.21) / wholeCycles;
    const breath = TAU * (Math.round(duration * 1.36) * progress +
      .10 * Math.sin(4 * TAU * progress));

    // The head leads along the route. Each following cross-section samples
    // farther back along the same curve before the lateral body wave is added.
    for (let i = 0; i < points.length; i++) {
      const along = distances[i] / length;
      const point = points[i];
      const station = distance - distances[i];
      sample(station, point, tangent);
      const curve = turnAcrossBody(sample, station, .21 * bodyScale, bendPoint, bendBefore, bendAfter);
      curveTurns[i] = curve;
      if (i === 0) headTangent.copy(tangent);
      if (spineFlex) {
        if (i) spineYaw[i] = spineYaw[i - 1] + Math.atan2(
          previousTangent.z * tangent.x - previousTangent.x * tangent.z,
          previousTangent.x * tangent.x + previousTangent.z * tangent.z);
        previousTangent.copy(tangent);
      }
      lateral.crossVectors(tangent, Y).normalize();
      const wave = phase - 4.85 * along;
      const weight = (.012 * along + .215 * along ** 2.5) *
        stroke * (1 - .30 * mix(Math.abs(curve), .25, 1.5));
      point.addScaledVector(lateral, bodyScale * weight * Math.sin(wave));
      point.y += bodyScale * .011 * along ** 2 * Math.sin(wave - 1.1);
    }

    for (let i = 0; i < joints.length; i++) {
      const joint = joints[i];
      forward.subVectors(points[i], points[i + 1]).normalize();
      if (i === 0) forward.lerp(headTangent, .42).normalize();
      else if (spineFlex) {
        const along = (distances[i] + distances[i + 1]) / (2 * length);
        const bodyYaw = spineYaw.at(-1) * along * (.79 + .21 * along);
        const localYaw = .5 * (spineYaw[i] + spineYaw[i + 1]);
        forward.applyAxisAngle(Y, spineFlex * (bodyYaw - localYaw));
      }
      lateral.crossVectors(forward, Y).normalize();
      up.crossVectors(lateral, forward);
      const roll = -.091 * Math.tanh(1.12 * curveTurns[i])
        + .021 * Math.sin(2 * TAU * progress + .5 - i * .13);
      joint.pose.setFromRotationMatrix(matrix.makeBasis(forward, up, lateral))
        .multiply(axisRotation.setFromAxisAngle(X, roll));
    }

    scene.quaternion.copy(joints[0].pose);
    scene.position.copy(joints[0].position).multiply(scene.scale)
      .applyQuaternion(scene.quaternion).negate().add(points[0]);
    rootRotationInverse.copy(scene.quaternion).invert();
    forward.copy(X).applyQuaternion(joints.at(-1).pose).applyQuaternion(rootRotationInverse);
    const tightening = mix(-forward.z * bend.angles.at(-1), 0, .18);
    const turnRoom = 1 - tightening * mix(X.angleTo(forward), 1.95, 2.58);

    for (const [i, joint] of joints.entries()) {
      body.frames[i].copy(rootRotationInverse).multiply(joint.pose)
        .premultiply(axisRotation.setFromAxisAngle(Y, bend.angles[i] * turnRoom));
    }
    body.pose();
    const swallow = poseFace(timeSeconds, swim?.meal);

    for (const fin of fins) {
      const { side, type, bone } = fin;
      let sweep;
      let feather;
      if (type === 'Gill') {
        const opening = (.5 + .5 * Math.sin(breath + .11 * side)) ** 1.7;
        sweep = side * (.032 * opening + .39 * swallow);
        feather = -side * (.004 + .042 * opening + .17 * swallow);
      } else {
        const stroke = finPhase + (side > 0 ? .33 : 1.75) +
          .30 * Math.sin(3 * TAU * progress + side);
        const power = type === 'Pectoral' ? 1 : .56;
        const steering = Math.tanh(curveTurns[0]) * side;
        sweep = side * power * (.029 + .044 * steering +
          (.073 + .042 * effort) * Math.sin(stroke) + .020 * Math.sin(2 * stroke + .45) + .16 * brake);
        feather = side * power * (.013 + (.075 + .026 * effort) * Math.sin(stroke - .92) + .076 * brake);
      }
      bone.quaternion.multiply(axisRotation.setFromAxisAngle(fin.sweep, sweep))
        .multiply(axisRotation.setFromAxisAngle(fin.feather, feather));
    }

    motion.head.copy(points[0]);
    motion.center.copy(scene.position);
    motion.heading.copy(X).applyQuaternion(scene.quaternion);
    motion.turn = curveTurns[0];
    motion.speed = swim?.speed ?? cruise.speed;
    motion.phase = phase;
    return motion;
  }

  update(0);
  return { update, getMotion: () => motion, duration, route, sampleCruise, trail: length, ...mouth };
}
