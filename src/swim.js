import * as THREE from 'three';

const TAU = 2 * Math.PI;
const X = new THREE.Vector3(1, 0, 0);
const Y = new THREE.Vector3(0, 1, 0);
const JOINTS = [
  'Head', 'Spine_1', 'Spine_2', 'Spine_3', 'Spine_4', 'Peduncle', 'Tail', 'Tail_Tip',
];

// A shallow front pass and a higher, deeper return. The wider ends give the
// arowana room to bank and turn without folding its body back on itself.
const WAYPOINTS = [
  [-2.17, .21, .78], [-1.38, .18, .98], [-.40, .15, 1.06],
  [ .65, .17, .97], [1.62, .22, .88], [2.43, .26, .70],
  [2.90, .26, .23], [3.02, .24, -.50], [2.72, .23, -1.20],
  [2.10, .25, -1.53], [1.09, .29, -1.62], [.12, .37, -1.68],
  [-.84, .44, -1.52], [-1.77, .48, -1.44], [-2.44, .45, -1.17],
  [-2.93, .37, -.64], [-3.02, .28, .11], [-2.75, .25, .61],
].map(([x, y, z]) => new THREE.Vector3(x, y, z));

const wrap = THREE.MathUtils.euclideanModulo;
const lerp = THREE.MathUtils.lerp;
const mix = THREE.MathUtils.smoothstep;

function evaluateCurve(parameter, position, tangent) {
  const segment = Math.floor(parameter);
  const u = parameter - segment;
  const v = 1 - u;
  const n = WAYPOINTS.length;
  const a = WAYPOINTS[wrap(segment - 1, n)];
  const b = WAYPOINTS[wrap(segment, n)];
  const c = WAYPOINTS[wrap(segment + 1, n)];
  const d = WAYPOINTS[wrap(segment + 2, n)];
  const u2 = u * u;
  const u3 = u2 * u;
  position.copy(a).multiplyScalar(v ** 3 / 6)
    .addScaledVector(b, (3 * u3 - 6 * u2 + 4) / 6)
    .addScaledVector(c, (-3 * u3 + 3 * u2 + 3 * u + 1) / 6)
    .addScaledVector(d, u3 / 6);
  tangent.copy(a).multiplyScalar(-v * v / 2)
    .addScaledVector(b, (3 * u2 - 4 * u) / 2)
    .addScaledVector(c, (-3 * u2 + 2 * u + 1) / 2)
    .addScaledVector(d, u2 / 2);
  const dx2 = v * a.x + (3 * u - 2) * b.x + (1 - 3 * u) * c.x + u * d.x;
  const dz2 = v * a.z + (3 * u - 2) * b.z + (1 - 3 * u) * c.z + u * d.z;
  const turn = (tangent.z * dx2 - tangent.x * dz2) /
    (tangent.x * tangent.x + tangent.z * tangent.z) ** 1.5;
  tangent.normalize();
  return turn;
}

function lowerIndex(table, key, value) {
  let first = 0;
  let last = table.length - 1;
  while (last - first > 1) {
    const mid = (first + last) >>> 1;
    if (table[mid][key] <= value) first = mid;
    else last = mid;
  }
  return first;
}

function buildRoute() {
  const count = WAYPOINTS.length * 80;
  const point = new THREE.Vector3();
  const tangent = new THREE.Vector3();
  const previous = new THREE.Vector3();
  const samples = [];
  let distance = 0;

  for (let i = 0; i <= count; i++) {
    const parameter = i * WAYPOINTS.length / count;
    const curvature = evaluateCurve(parameter, point, tangent);
    if (i) distance += point.distanceTo(previous);
    samples.push({ parameter, distance, curvature });
    previous.copy(point);
  }

  let elapsed = 0;
  let cycles = 0;
  for (const [i, sample] of samples.entries()) {
    const angle = TAU * sample.distance / distance;
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
    Object.assign(sample, { time: elapsed, cycles, speed, cadence, effort });
  }

  return {
    samples, length: distance, duration: elapsed, cycles,
    startTime: samples[Math.round(3.61 * 80)].time,
  };
}

const route = buildRoute();
const wholeCycles = Math.round(route.cycles);

function readDistance(distance, position, tangent) {
  const s = wrap(distance, route.length);
  const i = lowerIndex(route.samples, 'distance', s);
  const a = route.samples[i];
  const b = route.samples[i + 1];
  const u = (s - a.distance) / (b.distance - a.distance);
  return evaluateCurve(lerp(a.parameter, b.parameter, u), position, tangent);
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
  const inverseParent = bindTransform(bone.parent, rootInverse).rotation.invert();
  return {
    bone, side, type, bind: bone.quaternion.clone(),
    sweep: Y.clone().applyQuaternion(inverseParent),
    feather: X.clone().applyQuaternion(inverseParent),
  };
}

/**
 * Animate a glTF rig with +X toward the nose, +Y up and +Z toward the front
 * of the aquarium. Give the returned update method an absolute time in seconds.
 */
export function createSwimmer(scene) {
  scene.updateWorldMatrix(true, true);
  const rootInverse = scene.matrixWorld.clone().invert();
  const joints = JOINTS.map((name) => {
    const bone = scene.getObjectByName(name);
    if (!bone?.isBone) throw new Error(`Arowana skeleton is missing ${name}`);
    return {
      bone,
      ...bindTransform(bone, rootInverse),
      parentBind: bindTransform(bone.parent, rootInverse).rotation,
      rotationInModel: new THREE.Quaternion(),
      pose: new THREE.Quaternion(),
    };
  });
  for (let i = 1; i < joints.length; i++) {
    const joint = joints[i];
    joint.parentOffset = joints[i - 1].rotation.clone().invert().multiply(joint.parentBind);
  }

  const fins = ['Pectoral', 'Pelvic', 'Gill'].flatMap((type) => [
    bindFin(scene, `${type}_L`, 1, type, rootInverse),
    bindFin(scene, `${type}_R`, -1, type, rootInverse),
  ]).filter(Boolean);

  const distances = [0];
  const bodyScale = scene.scale.x;
  for (let i = 1; i < joints.length; i++) {
    distances.push(distances[i - 1] + bodyScale *
      joints[i].position.distanceTo(joints[i - 1].position));
  }
  // The trailing end of the fin continues beyond the final joint pivot.
  distances.push(distances.at(-1) + .23 * bodyScale);
  const length = distances.at(-1);
  const points = distances.map(() => new THREE.Vector3());
  const curveTurns = distances.map(() => 0);
  const headTangent = new THREE.Vector3();
  const tangent = new THREE.Vector3();
  const lateral = new THREE.Vector3();
  const forward = new THREE.Vector3();
  const up = new THREE.Vector3();
  const matrix = new THREE.Matrix4();
  const rootRotationInverse = new THREE.Quaternion();
  const axisRotation = new THREE.Quaternion();
  const parentRotationInverse = new THREE.Quaternion();
  const motion = {
    head: new THREE.Vector3(), center: new THREE.Vector3(), heading: new THREE.Vector3(),
    turn: 0, speed: 0, phase: 0,
  };

  function update(timeSeconds) {
    const t = wrap(timeSeconds + route.startTime, route.duration);
    const index = lowerIndex(route.samples, 'time', t);
    const a = route.samples[index];
    const b = route.samples[index + 1];
    const u = (t - a.time) / (b.time - a.time);
    const distance = lerp(a.distance, b.distance, u);
    const effort = lerp(a.effort, b.effort, u);
    const progress = t / route.duration;
    const phase = TAU * wholeCycles * lerp(a.cycles, b.cycles, u) / route.cycles;
    const finPhase = phase * Math.round(route.duration * 1.21) / wholeCycles;
    const breath = TAU * (Math.round(route.duration * 1.36) * progress +
      .10 * Math.sin(4 * TAU * progress));

    // The head leads along the route. Each following cross-section samples
    // farther back along the same curve before the lateral body wave is added.
    for (let i = 0; i < points.length; i++) {
      const along = distances[i] / length;
      const point = points[i];
      const curve = readDistance(distance - distances[i], point, tangent);
      curveTurns[i] = curve;
      if (i === 0) headTangent.copy(tangent);
      lateral.crossVectors(tangent, Y).normalize();
      const wave = phase - 4.85 * along;
      const weight = (.012 * along + .215 * along ** 2.5) *
        (.58 + .74 * effort) * (1 - .30 * mix(Math.abs(curve), .25, 1.5));
      point.addScaledVector(lateral, bodyScale * weight * Math.sin(wave));
      point.y += bodyScale * .011 * along ** 2 * Math.sin(wave - 1.1);
    }

    for (let i = 0; i < joints.length; i++) {
      const joint = joints[i];
      forward.subVectors(points[i], points[i + 1]).normalize();
      if (i === 0) forward.lerp(headTangent, .42).normalize();
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

    // Keep the rig's original bone lengths and roll. Convert route poses
    // into each parent's space so bends are independent of export orientation.
    for (const [i, joint] of joints.entries()) {
      joint.rotationInModel.copy(rootRotationInverse).multiply(joint.pose)
        .multiply(joint.rotation);
      parentRotationInverse.copy(i ? joints[i - 1].rotationInModel : joint.parentBind);
      if (i) parentRotationInverse.multiply(joint.parentOffset);
      joint.bone.quaternion.copy(parentRotationInverse.invert()).multiply(joint.rotationInModel);
    }

    for (const fin of fins) {
      const { side, type, bone } = fin;
      let sweep;
      let feather;
      if (type === 'Gill') {
        const opening = (.5 + .5 * Math.sin(breath + .11 * side)) ** 1.7;
        sweep = side * .011 * opening;
        feather = -side * (.004 + .033 * opening);
      } else {
        const stroke = finPhase + (side > 0 ? .33 : 1.75) +
          .30 * Math.sin(3 * TAU * progress + side);
        const power = type === 'Pectoral' ? 1 : .56;
        const steering = Math.tanh(curveTurns[0]) * side;
        sweep = side * power * (.029 + .044 * steering +
          (.073 + .042 * effort) * Math.sin(stroke) + .020 * Math.sin(2 * stroke + .45));
        feather = side * power * (.013 + (.075 + .026 * effort) * Math.sin(stroke - .92));
      }
      bone.quaternion.copy(axisRotation.setFromAxisAngle(fin.sweep, sweep))
        .multiply(axisRotation.setFromAxisAngle(fin.feather, feather)).multiply(fin.bind);
    }

    motion.head.copy(points[0]);
    motion.center.copy(scene.position);
    motion.heading.copy(X).applyQuaternion(scene.quaternion);
    motion.turn = curveTurns[0];
    motion.speed = lerp(a.speed, b.speed, u);
    motion.phase = phase;
    return motion;
  }

  update(0);
  return { update, getMotion: () => motion, duration: route.duration };
}
