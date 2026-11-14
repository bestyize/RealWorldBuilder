import { MathUtils, Matrix4, Quaternion, Vector3 } from 'three';

const TAU = 2 * Math.PI;
const UP = new Vector3(0, 1, 0);
const FORWARD = new Vector3(1, 0, 0);
// Each successive joint gains travel and lags behind the one before it.
const SPINE = [
  ['Head', .010, .00, .000],
  ['Body', .036, .53, .035],
  ['Peduncle', .067, 1.23, .095],
  ['TailBase', .093, 1.96, .092],
  ['TailMid', .115, 2.77, .078],
  ['TailEdge', .087, 3.65, .032],
];

export function createSwimmer(object, route) {
  const duration = route.length / .70;
  const tailBeats = Math.max(1, Math.round(duration * 2.30));
  const finBeats = Math.max(1, Math.round(duration * 3.20));
  const start = route.samples[route.startIndex].distance;
  const basis = new Matrix4();
  const forward = new Vector3();
  const up = new Vector3();
  const lateral = new Vector3();
  const lead = new Vector3();
  const turnPoint = new Vector3();
  const rotation = new Quaternion();
  const inverseModel = object.getWorldQuaternion(new Quaternion()).invert();
  const motion = { center: new Vector3() };

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

  const spine = SPINE.map(([name, amplitude, delay, bend]) => ({ ...bind(name), amplitude, delay, bend }));
  const fins = [[-1, 'Pectoral_L'], [1, 'Pectoral_R']].map(([side, name]) => ({ ...bind(name), side }));

  function update(timeSeconds) {
    const fraction = MathUtils.euclideanModulo(timeSeconds, duration) / duration;
    const angle = TAU * fraction;
    const pulse = 3 * angle + .53;
    const glide = .5 + .5 * Math.cos(pulse);
    const distance = start + route.length * (fraction + .020 * Math.sin(pulse) + .008 * Math.sin(2 * angle));
    const curvature = route.sample(distance, object.position, forward);
    const nextCurvature = route.sample(distance + .28, turnPoint, lead);
    const turn = Math.tanh(.66 * curvature + .34 * nextCurvature);
    forward.lerp(lead, .23).normalize();
    lateral.crossVectors(forward, UP).normalize();
    up.crossVectors(lateral, forward);
    object.quaternion.setFromRotationMatrix(basis.makeBasis(forward, up, lateral))
      .multiply(rotation.setFromAxisAngle(FORWARD, -.091 * turn + .023 * Math.sin(2 * angle)));
    const phase = tailBeats * angle + .58 * Math.sin(pulse);
    const power = (.55 + .50 * glide) * (1 - .23 * Math.abs(turn));

    for (const { bone, rest, yaw, roll, amplitude, delay, bend } of spine) {
      const stroke = phase - delay;
      const sweep = bend * turn + amplitude * power * (Math.sin(stroke) + .14 * Math.sin(2 * stroke + .62));
      bone.quaternion.copy(rest).multiply(rotation.setFromAxisAngle(yaw, sweep))
        .multiply(rotation.setFromAxisAngle(roll, amplitude * .20 * Math.sin(stroke - .75)));
    }

    for (const { bone, rest, yaw, roll, side } of fins) {
      const stroke = finBeats * angle + 1.12 * side + .32 * Math.sin(pulse);
      bone.quaternion.copy(rest).multiply(rotation.setFromAxisAngle(yaw, side * (.10 * Math.sin(stroke) - .04 * turn)))
        .multiply(rotation.setFromAxisAngle(roll, side * .15 * Math.sin(stroke - .89)));
    }
    motion.center.copy(object.position);
  }

  update(0);
  return { update, duration, getMotion: () => motion };
}
