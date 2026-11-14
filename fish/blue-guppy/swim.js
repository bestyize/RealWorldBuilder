import { MathUtils, Matrix4, Quaternion, Vector3 } from 'three';
import { lowerIndex } from '../swim-route.js';
import { createCaudalFin } from './caudal-fin.js';

const TAU = 2 * Math.PI;
const UP = new Vector3(0, 1, 0);
const FORWARD = new Vector3(1, 0, 0);
const { clamp, euclideanModulo: wrap, lerp, smoothstep } = MathUtils;
// The active stroke travels through the trunk and ends at the fin root.
const SPINE = [
  ['Body', .051, .029, .34],
  ['Peduncle', .109, .065, .60],
  ['TailBase', .118, .103, .46],
];

// Some callers may still load a GLB with the previous tail shape keys.
const LEGACY_TAIL = [
  ['TailMid', .075, .153, .28],
  ['TailEdge', .045, .201, .10],
];

function steering(curvature) {
  const amount = Math.abs(curvature);
  return Math.sign(curvature) * smoothstep(amount, .12, 1.40);
}

function pectoralPhase(angle, beats) {
  return beats * angle + .46 * Math.sin(2 * angle + .38);
}

function buildTiming(route, scale) {
  let duration = 0;
  let cycles = 0;
  const table = [];
  const turnDistance = .38 * scale;
  const position = new Vector3();
  const tangent = new Vector3();
  for (const { distance, curvature } of route.samples) {
    const angle = TAU * distance / route.length;
    const phrase = .5 + .5 * Math.sin(4 * angle + .38 + .52 * Math.sin(3 * angle - .2));
    const effort = .07 + .93 * phrase ** 1.8;
    const behind = route.sample(distance - turnDistance, position, tangent);
    const ahead = route.sample(distance + turnDistance, position, tangent);
    const turn = steering(scale * (.53 * curvature + .20 * behind + .27 * ahead));
    const speed = .61 + .53 * effort - .17 * Math.abs(turn);
    const cadence = 1.06 + 1.55 * effort + .16 * Math.abs(turn);
    const previous = table.at(-1);
    if (previous) {
      const dt = 2 * (distance - previous.distance) / (previous.speed + speed);
      duration += dt;
      cycles += .5 * dt * (cadence + previous.cadence);
    }
    table.push({ distance, time: duration, cycles, speed, cadence, effort, turn });
  }
  return { table, duration, cycles };
}

export function createSwimmer(object, route) {
  const scale = Math.abs(object.scale.x);
  const { table, duration, cycles } = buildTiming(route, scale);
  const startTime = table[route.startIndex].time;
  const beatScale = Math.max(1, Math.round(cycles)) / cycles;
  const finBeats = Math.max(1, Math.round(duration * 3.35));
  const basis = new Matrix4();
  const anchor = new Vector3();
  const forward = new Vector3();
  const up = new Vector3();
  const lateral = new Vector3();
  const aim = new Vector3();
  const scratch = new Vector3();
  const rotation = new Quaternion();
  const inverseModel = object.getWorldQuaternion(new Quaternion()).invert();
  const motion = { center: new Vector3() };
  const tailMesh = object.getObjectByName('Caudal_fan');
  const usesFinRays = tailMesh?.geometry?.hasAttribute('_fin_ray');

  function bind(name) {
    const bone = object.getObjectByName(name);
    if (!bone?.isBone) throw new Error(`Blue guppy skeleton is missing ${name}`);
    const inverse = bone.getWorldQuaternion(new Quaternion()).premultiply(inverseModel).invert();
    return {
      bone, rest: bone.quaternion.clone(),
      yaw: UP.clone().applyQuaternion(inverse),
      roll: FORWARD.clone().applyQuaternion(inverse),
    };
  }

  const spine = (usesFinRays ? SPINE : SPINE.concat(LEGACY_TAIL))
    .map(([name, amplitude, lag, bend]) => ({ ...bind(name), amplitude, lag, bend }));
  const pectorals = [[1, 'Pectoral_L', .45], [-1, 'Pectoral_R', 2.32]].map(([side, name, phase]) => ({
    ...bind(name), side, phase,
  }));
  // Each pair of wave weights propagates the deformation along the fin rays.
  const membraneSpecs = [
    ['Dorsal_sail', .14, .42, .55, .43, .73],
    ['Anal_fin', .085, .34, .48, .34, 1.02],
    ['Pelvic_fin_L', .098, .23, .38, .29, .88],
    ['Pelvic_fin_R', .126, .23, .37, .29, 1.19],
    ['Pectoral_membrane_L', .068, .55, .28, .13, .45],
    ['Pectoral_membrane_R', .079, .53, .28, .13, 2.32],
  ];
  if (!usesFinRays) membraneSpecs.push(['Caudal_fan', .19, .68, .59, .47, 0]);
  const membranes = membraneSpecs.map(([name, lag, response, ripple, drag, offset]) => {
    const mesh = object.getObjectByName(name);
    const indices = mesh?.morphTargetDictionary;
    if (!indices || [indices.Flex, indices.WaveA, indices.WaveB].some(index => index === undefined)) {
      throw new Error(`Blue guppy mesh is missing fin deformation on ${name}`);
    }
    return {
      weights: mesh.morphTargetInfluences, indices, lag, response, ripple, drag, offset,
      pectoral: name.startsWith('Pectoral'),
    };
  });

  const head = {};
  const delayed = {};
  const previous = {};
  function sample(time, state) {
    const wrapped = wrap(time, duration);
    const i = lowerIndex(table, 'time', wrapped);
    const a = table[i];
    const b = table[i + 1];
    const u = (wrapped - a.time) / (b.time - a.time);
    state.distance = lerp(a.distance, b.distance, u);
    state.effort = lerp(a.effort, b.effort, u);
    state.phase = TAU * beatScale * lerp(a.cycles, b.cycles, u);
    state.angle = TAU * wrapped / duration;
    state.turn = lerp(a.turn, b.turn, u);
  }

  function turningBend(time, turn) {
    // A stronger initial bend eases back on a sustained arc. A small
    // counter-bend appears naturally when the turning demand falls away.
    sample(time - .31, previous);
    const recent = previous.turn;
    sample(time - .69, previous);
    const change = (turn - recent) / 2 + (turn - previous.turn) / 2;
    return .058 * turn + .38 * Math.tanh(change);
  }

  function orient(joint, yaw, roll) {
    joint.bone.quaternion.copy(joint.rest).multiply(rotation.setFromAxisAngle(joint.yaw, yaw))
      .multiply(rotation.setFromAxisAngle(joint.roll, roll));
  }

  function poseBody(timeSeconds) {
    const time = timeSeconds + startTime;
    sample(time, head);
    const { distance, effort, phase, angle } = head;
    route.sample(distance, anchor, forward);
    route.sample(distance + .32 * scale, scratch, aim);
    const turn = head.turn;
    const bend = turningBend(time, turn);
    forward.lerp(aim, .50).normalize();
    lateral.crossVectors(forward, UP).normalize();
    up.crossVectors(lateral, forward);

    // The head steers first. Roll and lift are small corrections to the path.
    const bank = -.048 * turn - .16 * bend + .023 * Math.sin(2 * angle + .4);
    object.quaternion.setFromRotationMatrix(basis.makeBasis(forward, up, lateral))
      .multiply(rotation.setFromAxisAngle(UP, .035 * turn + .13 * bend + .034 * effort * Math.sin(phase)))
      .multiply(rotation.setFromAxisAngle(FORWARD, bank));
    object.position.copy(anchor)
      .addScaledVector(lateral, scale * (.016 + .014 * effort) * Math.sin(phase - .32));
    object.position.y += scale * (.048 * Math.sin(2 * angle + .30) + .031 * Math.sin(3 * angle - .46));

    for (const joint of spine) {
      const jointTime = time - joint.lag;
      sample(jointTime, delayed);
      const drive = .19 + 1.04 * delayed.effort;
      const localBend = turningBend(jointTime, delayed.turn);
      const kick = drive * (Math.sin(delayed.phase) + .14 * Math.sin(2 * delayed.phase + .54));
      const yaw = joint.bend * localBend + joint.amplitude * kick * (1 - .85 * Math.abs(localBend));
      const roll = .24 * joint.amplitude * Math.sin(delayed.phase - .74);
      orient(joint, yaw, roll);
    }
    return effort;
  }

  const caudalFin = usesFinRays ? createCaudalFin(
    tailMesh, spine.at(-1).bone, duration,
    time => {
      const effort = poseBody(time);
      object.updateMatrixWorld(true);
      return effort;
    },
  ) : null;

  function update(timeSeconds) {
    const effort = poseBody(timeSeconds);
    const time = timeSeconds + startTime;
    const { angle, turn } = head;
    const bend = turningBend(time, turn);
    caudalFin?.(timeSeconds);
    const finPhase = pectoralPhase(angle, finBeats);
    for (const fin of pectorals) {
      const stroke = finPhase + fin.phase;
      const trim = (.33 + .60 * (1 - effort)) * (1 + .28 * fin.side * bend);
      const pull = .5 + .5 * Math.sin(stroke);
      orient(fin, -fin.side * (.22 * trim * pull ** 1.5 + .09 * turn),
        fin.side * trim * (.11 + .25 * Math.sin(stroke - .70)));
    }

    for (const fin of membranes) {
      const finTime = time - fin.lag;
      sample(finTime, delayed);
      const beat = fin.pectoral ? pectoralPhase(delayed.angle, finBeats) + fin.offset
        : delayed.phase - fin.offset;
      const flowTurn = .20 * delayed.turn + 1.15 * turningBend(finTime, delayed.turn);
      const load = fin.pectoral ? .28 + .62 * (1 - delayed.effort) : .32 + .55 * delayed.effort;
      const drift = .080 * Math.sin(5 * angle + fin.offset) + .045 * Math.sin(8 * angle - .47);
      const bend = fin.response * load * Math.sin(beat - .86) - fin.drag * flowTurn + drift;
      const wave = fin.ripple * load * (1 + .15 * Math.abs(flowTurn));
      const { Flex, WaveA, WaveB, Gather } = fin.indices;
      fin.weights[Flex] = clamp(bend, -.94, .94);
      fin.weights[WaveA] = wave * Math.sin(beat);
      fin.weights[WaveB] = -wave * Math.cos(beat);
      if (Gather !== undefined) {
        const stroke = Math.sin(beat - .80);
        fin.weights[Gather] = .11 + (.22 + .47 * delayed.effort) * stroke ** 2 + .13 * Math.abs(turn);
      }
    }

    motion.center.copy(object.position);
  }

  update(0);
  return { update, duration, getMotion: () => motion };
}
