import { Vector3 } from 'three';

// A quintic joins the positions, tangents, and curvature on either side.
export function roundSwimJunction(frame, start, end, entryAcceleration, exitAcceleration) {
  const point = new Vector3();
  const tangent = new Vector3();
  const acceleration = new Vector3();
  const length = end - start;
  frame(start, point, tangent, acceleration);
  const a = point.clone();
  const b = tangent.clone().multiplyScalar(length);
  const c = (entryAcceleration ?? acceleration).clone().multiplyScalar(.5 * length * length);
  frame(end, point, tangent, acceleration);
  const displacement = point.clone().sub(a).sub(b).sub(c);
  const velocity = tangent.clone().multiplyScalar(length).sub(b).addScaledVector(c, -2);
  const change = (exitAcceleration ?? acceleration).clone().multiplyScalar(length * length).addScaledVector(c, -2);
  const d = displacement.clone().multiplyScalar(10).addScaledVector(velocity, -4).addScaledVector(change, .5);
  const e = displacement.clone().multiplyScalar(-15).addScaledVector(velocity, 7).sub(change);
  const f = displacement.clone().multiplyScalar(6).addScaledVector(velocity, -3).addScaledVector(change, .5);

  return {
    start, end,
    sample(distance, point, tangent, acceleration) {
      const t = (distance - start) / length;
      point.copy(f).multiplyScalar(t).add(e).multiplyScalar(t).add(d)
        .multiplyScalar(t).add(c).multiplyScalar(t).add(b).multiplyScalar(t).add(a);
      tangent.copy(f).multiplyScalar(5 * t).addScaledVector(e, 4).multiplyScalar(t).addScaledVector(d, 3)
        .multiplyScalar(t).addScaledVector(c, 2).multiplyScalar(t).add(b).divideScalar(length);
      acceleration.copy(f).multiplyScalar(20 * t).addScaledVector(e, 12).multiplyScalar(t)
        .addScaledVector(d, 6).multiplyScalar(t).addScaledVector(c, 2).divideScalar(length * length);
    },
  };
}

export function cruiseAcceleration(route, distance) {
  const point = new Vector3();
  const a = new Vector3();
  const b = new Vector3();
  const step = .016;
  route.sample(distance - step, point, a);
  route.sample(distance + step, point, b);
  const horizontalA = Math.hypot(a.x, a.z);
  const horizontalB = Math.hypot(b.x, b.z);
  return b.divideScalar(horizontalB).sub(a.divideScalar(horizontalA))
    .divideScalar(step * (horizontalA + horizontalB));
}
