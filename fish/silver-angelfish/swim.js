import { MathUtils, Matrix4, Mesh, Quaternion, Vector3 } from 'three';
const TAU = Math.PI * 2;
const UP = new Vector3(0, 1, 0);
const FORWARD = new Vector3(1, 0, 0);

/** Stable compressed trunk; gentle caudal/sculling motion rather than an eel wave.
 * Absolute-time poses support pause, arbitrary seek, looping and independent fish.
 * Editable GLB bones stay in bind pose; runtime geometry is cloned per instance.
 */
export function createSwimmer(scene, route, { duration = 48, phaseOffset = 0 } = {}) {
  if (!(duration > 0) || !Number.isFinite(duration)) throw new Error('Angelfish duration must be positive');
  if (!Number.isFinite(phaseOffset)) throw new Error('Angelfish phase must be finite');
  scene.updateWorldMatrix(true, true);
  const inverse = scene.matrixWorld.clone().invert();
  const sources = [];
  scene.traverse(mesh => { if (mesh.isMesh) sources.push(mesh); });
  const parts = sources.map(source => {
    const geometry = source.geometry.clone();
    geometry.applyMatrix4(new Matrix4().multiplyMatrices(inverse, source.matrixWorld));
    // Derivative tangents follow the posed surface; exported rest tangents would not.
    geometry.deleteAttribute('tangent');
    const mesh = new Mesh(geometry, source.material);
    mesh.name = source.name;
    mesh.frustumCulled = false;
    source.removeFromParent();
    scene.add(mesh);
    return { mesh, position: geometry.attributes.position, normal: geometry.attributes.normal,
      rest: geometry.attributes.position.array.slice(), restNormal: geometry.attributes.normal?.array.slice() };
  });
  const tangent = new Vector3(), lateral = new Vector3(), up = new Vector3();
  const matrix = new Matrix4(), roll = new Quaternion();
  const motion = { center: new Vector3(), head: new Vector3(), heading: new Vector3(), turn: 0, speed: 0, phase: 0 };
  const start = route.samples[route.startIndex]?.distance ?? 0;
  const beats = Math.max(1, Math.round(duration * .75));
  function update(seconds) {
    if (!Number.isFinite(seconds)) throw new Error('Angelfish time must be finite');
    const p = MathUtils.euclideanModulo(seconds / duration + phaseOffset, 1);
    // Two short drifts separated by low-speed hovering; monotonic and C1 periodic.
    const bout = 4 * Math.PI * p;
    const travel = p - .94 * Math.sin(bout) / (4 * Math.PI);
    const effort = .5 - .5 * Math.cos(bout);
    const phase = TAU * beats * p;
    const turn = route.sample(start + route.length * travel, motion.center, tangent);
    for (const part of parts) {
      const { rest, position, normal, restNormal, mesh } = part;
      for (let i = 0; i < rest.length; i += 3) {
        const x = rest[i], y = rest[i + 1], z = rest[i + 2];
        // Same field for caudal peduncle and tail keeps their shared attachment fixed.
        const aft = x >= -1.150001 ? 0 : -1.15 - x;
        const angle = (.025 + .045 * effort) * Math.sin(phase - aft * .65) * Math.min(1, aft * aft);
        const c = Math.cos(angle), s = Math.sin(angle);
        let px = aft ? -1.15 + (x + 1.15) * c - z * s : x;
        let py = y;
        let pz = aft ? (x + 1.15) * s + z * c : z;
        let flutter = 0;
        if (/AngelDorsal|AngelAnal/.test(mesh.name)) {
          const edge = Math.max(0, Math.abs(y) - 1.15);
          flutter = .018 * edge * edge * Math.sin(phase * 2 - x * 1.8 - Math.abs(y));
        } else if (/AngelPelvic/.test(mesh.name)) {
          const free = Math.max(0, -y - .76);
          flutter = .018 * free * free * Math.sin(phase - free * 1.2);
        } else if (/AngelPectoral/.test(mesh.name)) {
          const free = Math.max(0, Math.abs(z) - .185);
          flutter = Math.sign(z) * .10 * free * Math.sin(phase * 2);
          py += .06 * free * Math.sin(phase * 2 + .8);
        }
        position.array[i] = px; position.array[i + 1] = py; position.array[i + 2] = pz + flutter;
        if (normal && restNormal) {
          const nx = restNormal[i], ny = restNormal[i + 1], nz = restNormal[i + 2];
          normal.array[i] = c * nx - s * nz;
          normal.array[i + 1] = ny;
          normal.array[i + 2] = s * nx + c * nz;
        }
      }
      position.needsUpdate = true;
      if (normal) normal.needsUpdate = true;
    }
    motion.center.y += .022 * Math.sin(TAU * 2 * p);
    lateral.crossVectors(tangent, UP).normalize();
    up.crossVectors(lateral, tangent).normalize();
    scene.quaternion.setFromRotationMatrix(matrix.makeBasis(tangent, up, lateral));
    scene.quaternion.multiply(roll.setFromAxisAngle(FORWARD, -.025 * Math.tanh(turn)));
    scene.position.copy(motion.center);
    motion.head.set(1.5, 0, 0).multiply(scene.scale).applyQuaternion(scene.quaternion).add(scene.position);
    motion.heading.copy(tangent);
    motion.turn = turn;
    motion.speed = route.length / duration * (1 - .94 * Math.cos(bout));
    motion.phase = phase;
    return motion;
  }
  update(0);
  return { update, getMotion: () => motion, duration };
}
