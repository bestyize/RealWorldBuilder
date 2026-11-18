import { MathUtils, Matrix4, Quaternion, Vector3 } from 'three';
import { createContinuousBody, turnAcrossBody } from '../arowana/continuous-body.js';
import { createTurnResponse } from '../arowana/turn-response.js';
import { bindFeedingFace } from '../arowana/feeding-face.js';
import { bindSwimMouth } from '../swim-mouth.js';

const UP = new Vector3(0, 1, 0);
const FORWARD = new Vector3(1, 0, 0);
const CYCLE = Math.PI * 2;
const CRUISE_SPEED = .62;
const BODY_TRIM = -.064;
const TURN_REACH = .82;
const TURN_LIMIT = .89;
const spine = ['Head', 'Shoulder', 'SpineA', 'SpineB', 'Peduncle', 'Tail', 'TailTip'];

function bindBone(object, name, rootRotation) {
  const bone = object.getObjectByName(name);
  if (!bone?.isBone) throw new Error(`Vermilion arowana rig is missing ${name}`);
  // Map the fish's axes into this bone's own rest orientation.
  const toBone = bone.getWorldQuaternion(new Quaternion()).invert().multiply(rootRotation);
  return {
    bone,
    yaw: UP.clone().applyQuaternion(toBone),
    roll: FORWARD.clone().applyQuaternion(toBone),
  };
}

export function createSwimmer(object, route, { duration: requestedDuration } = {}) {
  object.updateWorldMatrix(true, true);
  const rootRotation = object.getWorldQuaternion(new Quaternion());
  const joints = spine.map(name => {
    const bone = object.getObjectByName(name);
    if (!bone?.isBone) throw new Error(`Vermilion arowana rig is missing ${name}`);
    const station = object.worldToLocal(bone.getWorldPosition(new Vector3())).x;
    return { bone, station };
  });
  const firstStation = joints[0].station;
  const lastStation = joints.at(-1).station;
  const stations = joints.map(({ station }) => (firstStation - station) / (firstStation - lastStation));
  const bend = createTurnResponse(stations, object.scale.x, .31);
  for (const [i, joint] of joints.entries()) {
    const along = stations[i];
    joint.turnReach = along * (.74 + .26 * along);
    joint.waveDelay = 4.8 * along;
    joint.waveAmplitude = .079 * along ** 2.65;
    joint.waveSlope = .079 * 2.65 * along ** 1.65;
  }
  const routeTurns = new Float64Array(joints.length);
  const fins = ['Pectoral', 'Pelvic'].flatMap((kind) => ['L', 'R'].map((suffix) => {
    const fin = bindBone(object, `${kind}_${suffix}`, rootRotation);
    const position = object.worldToLocal(fin.bone.getWorldPosition(new Vector3()));
    return { ...fin, side: Math.sign(position.z), span: kind === 'Pectoral' ? 1 : .55 };
  }));
  const body = createContinuousBody(object, joints.map(joint => joint.bone), fins.map(fin => fin.bone), 1.08);
  const mouthCorner = 1.39;
  const poseFace = bindFeedingFace(object, joints[0].bone, {
    hinge: new Vector3(1.245, .055, 0),
    corner: mouthCorner,
    lipHeight: x => .164 + .123 * MathUtils.smoothstep(x, mouthCorner, 1.558),
    angle: .274,
  }, {
    hinge: new Vector3(1.19, 0, 0),
    rear: .88,
    centerY: -.025,
    angle: .35,
  });

  const defaultDuration = route.length / CRUISE_SPEED;
  const duration = requestedDuration ?? defaultDuration;
  if (!Number.isFinite(duration) || duration <= 0) throw new RangeError('Invalid Vermilion arowana swim duration');
  const speed = route.length / duration;
  // Stretch the strokes with the lap so a slower fish also beats its fins more slowly.
  const tailStrokes = Math.max(1, Math.round(defaultDuration * .54));
  const finStrokes = Math.max(1, Math.round(defaultDuration * .79));
  const gillStrokes = Math.max(1, Math.round(defaultDuration * .95));
  const startDistance = route.samples[route.startIndex].distance;
  const cadence = 3 * CYCLE;
  const speedVariation = .16;
  const motion = { center: new Vector3(), heading: new Vector3(), turn: 0, speed: 0, phase: 0 };
  const routePoint = new Vector3();
  const localHeading = new Vector3();
  const earlierHeading = new Vector3();
  const torsoCenter = new Vector3();
  const forward = new Vector3();
  const side = new Vector3();
  const up = new Vector3();
  const orientation = new Matrix4();
  const rotation = new Quaternion();

  const reach = object.scale.x * TURN_REACH;
  const mouth = bindSwimMouth(object, joints[0].bone, 1.55, .245);
  mouth.mouthOffset.applyAxisAngle(new Vector3(0, 0, 1), BODY_TRIM);
  const cruise = {};

  function sampleCruise(timeSeconds, out) {
    const progress = MathUtils.euclideanModulo(timeSeconds / duration, 1);
    const glide = cadence * progress;
    // Integrate a periodic speed so distance, phase and speed all close at the loop seam.
    const travel = progress + speedVariation * Math.sin(glide) / cadence;
    out.travel = travel;
    out.phase = CYCLE * tailStrokes * travel;
    out.effort = .76 + .24 * Math.cos(glide);
    out.distance = startDistance + travel * route.length;
    out.speed = speed * (1 + speedVariation * Math.cos(glide));
  }

  function update(timeSeconds, swim) {
    sampleCruise(timeSeconds, cruise);
    const { travel } = cruise;
    const pace = swim?.pace ?? cruise;
    const tail = swim?.tail;
    const phase = tail?.phase ?? pace.phase;
    const effort = MathUtils.lerp(pace.effort, .24 + .76 * (tail?.effort ?? 0), tail?.blend ?? 0);
    const brake = tail?.brake ?? 0;
    const distance = swim?.distance ?? cruise.distance;
    const sample = swim?.sample ?? route.sample;
    const curvature = sample(distance, motion.center, motion.heading);
    bend.update(swim?.cruiseTime ?? timeSeconds, sample, swim?.samplePace ?? sampleCruise);
    const approachingTurn = turnAcrossBody(sample, distance + .56 * reach, .38 * reach,
      routePoint, earlierHeading, localHeading);
    const steer = MathUtils.lerp(Math.tanh(1.5 * approachingTurn), bend.tailTurn, .22);
    const strokeEffort = MathUtils.lerp(.48 + .43 * pace.effort,
      .15 + .98 * (tail?.effort ?? 0), tail?.blend ?? 0) * (1 - .16 * Math.abs(steer));
    const heading = motion.heading;
    const slope = Math.atan2(heading.y, Math.hypot(heading.x, heading.z));
    // Trim the model's upturned silhouette while following climbs and dives.
    const pitch = BODY_TRIM + MathUtils.lerp(.57, .86, swim?.spineFlex ?? 0)
      * MathUtils.clamp(slope, -.44, .44) + .019 * brake;
    forward.set(heading.x, 0, heading.z).normalize()
      .multiplyScalar(Math.cos(pitch)).addScaledVector(UP, Math.sin(pitch));
    side.crossVectors(forward, UP).normalize();
    up.crossVectors(side, forward);
    object.position.copy(motion.center);
    object.quaternion.setFromRotationMatrix(orientation.makeBasis(forward, up, side))
      .multiply(rotation.setFromAxisAngle(FORWARD, -.115 * steer + .009 * Math.sin(phase)));

    for (const [i, joint] of joints.entries()) {
      sample(distance + joint.station * reach, routePoint, localHeading);
      const yaw = Math.atan2(heading.z * localHeading.x - heading.x * localHeading.z,
        heading.x * localHeading.x + heading.z * localHeading.z);
      routeTurns[i] = TURN_LIMIT * Math.tanh(yaw / TURN_LIMIT);
    }

    // Follow the tangent of one lateral wave. Its displacement grows
    // toward the tail and the head is nearly still during a glide.
    const spineFlex = .84 * (swim?.spineFlex ?? 0);
    for (const [i, joint] of joints.entries()) {
      const bodyTurn = MathUtils.lerp(routeTurns[0], routeTurns.at(-1), joint.turnReach);
      const turn = MathUtils.lerp(routeTurns[i], bodyTurn, spineFlex);
      const wave = phase - joint.waveDelay;
      const heading = turn + bend.angles[i] + Math.atan(strokeEffort * (
        joint.waveSlope * Math.sin(wave) - 4.8 * joint.waveAmplitude * Math.cos(wave)));
      body.frames[i].setFromAxisAngle(UP, heading);
    }

    body.pose();
    object.position.sub(torsoCenter.copy(body.center).multiply(object.scale).applyQuaternion(object.quaternion));
    const breathing = .14 * (.5 + .5 * Math.sin(CYCLE * gillStrokes * travel)) ** 1.7;
    poseFace(timeSeconds, swim?.meal, breathing);

    for (const fin of fins) {
      const phaseOffset = fin.side > 0 ? .45 : 1.18;
      const stroke = CYCLE * finStrokes * travel + phaseOffset;
      const steering = fin.side * steer;
      const sweep = fin.side * fin.span * (.022 + .081 * effort * Math.sin(stroke) + .074 * steering + .17 * brake);
      const feather = fin.side * fin.span * (.012 + .070 * effort * Math.sin(stroke + 1.1) + .042 * Math.max(0, steering)
        + .078 * brake);
      fin.bone.quaternion.multiply(rotation.setFromAxisAngle(fin.yaw, sweep))
        .multiply(rotation.setFromAxisAngle(fin.roll, feather));
    }

    motion.turn = curvature;
    motion.speed = swim?.speed ?? cruise.speed;
    motion.phase = phase;
    return motion;
  }

  update(0);
  return {
    update, getMotion: () => motion, duration, route, sampleCruise,
    trail: -lastStation * reach, lead: firstStation * reach, ...mouth,
  };
}
