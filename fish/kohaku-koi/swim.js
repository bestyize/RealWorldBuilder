import { MathUtils, Matrix4, Mesh, Quaternion, Vector3 } from 'three';

const TAU = Math.PI * 2;
const UP = new Vector3(0, 1, 0);
const FORWARD = new Vector3(1, 0, 0);

/** Absolute-time, deterministic carangiform swimming. Every instance owns its geometry. */
export function createSwimmer(scene, route, { duration = 38, phaseOffset = 0 } = {}) {
  if (!(duration > 0) || !Number.isFinite(duration)) throw new Error('Koi duration must be positive');
  scene.updateWorldMatrix(true, true);
  const inverse = scene.matrixWorld.clone().invert();
  const meshes = [];
  scene.traverse(mesh => { if (mesh.isMesh) meshes.push(mesh); });
  const parts = meshes.map(source => {
    const geometry = source.geometry.clone();
    geometry.applyMatrix4(new Matrix4().multiplyMatrices(inverse, source.matrixWorld));
    // The editable GLB keeps a rig; the real-time procedural controller operates
    // on bind-pose vertices instead, without applying skinning a second time.
    const mesh = new Mesh(geometry, source.material);
    mesh.name = source.name;
    source.removeFromParent();
    scene.add(mesh);
    mesh.position.set(0, 0, 0);
    mesh.quaternion.identity();
    mesh.scale.set(1, 1, 1);
    mesh.geometry = geometry;
    mesh.frustumCulled = false;
    return {
      mesh, position: geometry.attributes.position,
      normal: geometry.attributes.normal,
      rest: geometry.attributes.position.array.slice(),
      restNormal: geometry.attributes.normal?.array.slice(),
      paired: /Pectoral|Pelvic/.test(mesh.name),
      side: /_L(?:_|$)/.test(mesh.name) ? 1 : -1,
    };
  });
  const tangent = new Vector3();
  const lateral = new Vector3();
  const up = new Vector3();
  const matrix = new Matrix4();
  const roll = new Quaternion();
  const motion = { center: new Vector3(), head: new Vector3(), heading: new Vector3(), turn: 0, speed: 0, phase: 0 };
  const start = route.samples[route.startIndex]?.distance ?? 0;
  // An integral beat count closes both route and tail motion at the loop seam.
  const beats = Math.max(1, Math.round(duration * .83));

  // Integrating a centerline preserves longitudinal lengths. Cross-sections
  // rotate with its tangent, so the tail bends rather than sliding sideways.
  const sections = 160;
  const shoulder = 1.3;
  const spineLength = 4.7;
  const step = spineLength / sections;
  const centerX = new Float64Array(sections + 1);
  const centerZ = new Float64Array(sections + 1);
  const angles = new Float64Array(sections + 1);

  function update(seconds) {
    const progress = MathUtils.euclideanModulo(seconds / duration + phaseOffset, 1);
    const bout = TAU * 3 * progress;
    const routeProgress = progress + .010 * Math.sin(bout);
    const effort = .5 + .5 * Math.cos(bout);
    const phase = TAU * beats * progress + .35 * Math.sin(bout);
    const turn = route.sample(start + route.length * routeProgress, motion.center, tangent);
    const bend = -.28 * Math.tanh(turn * .8);
    const amplitude = .18 + .16 * effort ** 2;
    centerX[0] = shoulder;
    centerZ[0] = 0;
    angles[0] = 0;
    for (let i = 1; i <= sections; i++) {
      const t = i / sections;
      angles[i] = amplitude * t ** 2.2 * Math.sin(phase - 4.1 * t)
        + bend * t ** 1.8;
      const mid = (angles[i] + angles[i - 1]) * .5;
      centerX[i] = centerX[i - 1] - step * Math.cos(mid);
      centerZ[i] = centerZ[i - 1] - step * Math.sin(mid);
    }
    for (const part of parts) {
      const { position, normal, rest, restNormal, paired, side } = part;
      for (let i = 0; i < rest.length; i += 3) {
        const x = rest[i], y = rest[i + 1], z = rest[i + 2];
        const s = MathUtils.clamp((shoulder - x) / step, 0, sections);
        const lo = Math.min(sections - 1, Math.floor(s));
        const f = s - lo;
        const theta = MathUtils.lerp(angles[lo], angles[lo + 1], f);
        const sn = Math.sin(theta), cs = Math.cos(theta);
        const cx = x >= shoulder ? x : MathUtils.lerp(centerX[lo], centerX[lo + 1], f);
        const cz = MathUtils.lerp(centerZ[lo], centerZ[lo + 1], f);
        // A quiet asymmetric sculling stroke keeps paired fin roots planted.
        const finAngle = paired ? side * (.035 + .11 * Math.sin(phase + side * .8)) : 0;
        const finSpan = Math.max(0, Math.abs(z) - .24);
        const finY = finSpan * Math.sin(finAngle);
        const localZ = z - Math.sign(z) * finSpan * (1 - Math.cos(finAngle));
        position.array[i] = cx - sn * localZ;
        position.array[i + 1] = y + finY;
        position.array[i + 2] = cz + cs * localZ;
        if (normal && restNormal) {
          const nx = restNormal[i], ny = restNormal[i + 1], nz = restNormal[i + 2];
          const fy = paired ? ny * Math.cos(finAngle) + side * nz * Math.sin(finAngle) : ny;
          const fz = paired ? nz * Math.cos(finAngle) - side * ny * Math.sin(finAngle) : nz;
          normal.array[i] = cs * nx - sn * fz;
          normal.array[i + 1] = fy;
          normal.array[i + 2] = sn * nx + cs * fz;
        }
      }
      position.needsUpdate = true;
      if (normal) normal.needsUpdate = true;
    }
    lateral.crossVectors(tangent, UP).normalize();
    up.crossVectors(lateral, tangent).normalize();
    scene.quaternion.setFromRotationMatrix(matrix.makeBasis(tangent, up, lateral));
    scene.quaternion.multiply(roll.setFromAxisAngle(FORWARD, -.065 * Math.tanh(turn)));
    scene.position.copy(motion.center);
    motion.head.set(2.3, 0, 0).multiply(scene.scale).applyQuaternion(scene.quaternion).add(scene.position);
    motion.heading.copy(tangent);
    motion.turn = turn;
    motion.speed = route.length / duration * (1 + .030 * TAU * Math.cos(bout));
    motion.phase = phase;
    return motion;
  }
  update(0);
  return { update, getMotion: () => motion, duration };
}
