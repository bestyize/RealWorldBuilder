import {
  BufferAttribute, BufferGeometry, Color, DoubleSide, Float32BufferAttribute,
  MathUtils, Matrix3, Matrix4, Mesh, MeshStandardMaterial, Vector3,
} from 'three';

const UP = new Vector3(0, 1, 0);
const { smoothstep, smootherstep } = MathUtils;

function toModelSpace(mesh, rootInverse) {
  const { bones, boneInverses } = mesh.skeleton;
  return new Matrix4().multiplyMatrices(rootInverse, bones[0].matrixWorld)
    .multiply(boneInverses[0]).multiply(mesh.bindMatrix);
}

// Split only the faces across the lip. Each side gets its own cut vertices
// so opening the jaw separates the surfaces instead of stretching the skin.
function splitLip(geometry, toModel, jaw) {
  const point = new Vector3();
  const positions = [];
  const distances = [];
  const lower = [];
  const lipEdges = [];
  const attributes = Object.entries(geometry.attributes).map(([name, attr]) =>
    ({ name, attr, values: Array.from(attr.array) }));
  const { position } = geometry.attributes;
  for (let i = 0; i < position.count; i++) {
    const p = new Vector3().fromBufferAttribute(position, i).applyMatrix4(toModel);
    const distance = p.y - jaw.lipHeight(p.x);
    positions.push(p);
    distances.push(distance);
    lower.push(distance < 0);
  }
  let count = position.count;
  function addCutVertex(a, b, t, underside) {
    for (const { name, attr, values } of attributes) {
      // The lip is within the rigid head. Its new vertices can use the
      // skinning of either endpoint while interpolating the surface data.
      for (let i = 0; i < attr.itemSize; i++) {
        const start = attr.array[a * attr.itemSize + i];
        const end = attr.array[b * attr.itemSize + i];
        values.push(name.startsWith('skin') ? (t < .5 ? start : end) : MathUtils.lerp(start, end, t));
      }
    }
    lower.push(underside);
    return count++;
  }

  const indices = [];
  function pushFaces(vertices) {
    for (let i = 2; i < vertices.length; i++) indices.push(vertices[0], vertices[i - 1], vertices[i]);
  }
  const original = geometry.index.array;
  for (let i = 0; i < original.length; i += 3) {
    const a = original[i], b = original[i + 1], c = original[i + 2];
    if ((lower[a] === lower[b] && lower[a] === lower[c]) ||
        Math.max(positions[a].x, positions[b].x, positions[c].x) <= jaw.corner) {
      indices.push(a, b, c);
      continue;
    }
    const upperFace = [], lowerFace = [], edge = [];
    const triangle = [a, b, c];
    for (let j = 0; j < 3; j++) {
      const start = triangle[j], end = triangle[(j + 1) % 3];
      (lower[start] ? lowerFace : upperFace).push(start);
      if (lower[start] === lower[end]) continue;
      const t = distances[start] / (distances[start] - distances[end]);
      upperFace.push(addCutVertex(start, end, t, false));
      lowerFace.push(addCutVertex(start, end, t, true));
      edge.push(point.copy(positions[start]).lerp(positions[end], t).clone());
    }
    pushFaces(upperFace);
    pushFaces(lowerFace);
    lipEdges.push(edge);
  }
  for (const { name, attr, values } of attributes) {
    geometry.setAttribute(name, new BufferAttribute(new attr.array.constructor(values), attr.itemSize, attr.normalized));
  }
  geometry.setIndex(indices);
  return { lower, lipEdges };
}

function poseLip(point, normal, jaw, lower) {
  // The lips separate in front of the mouth corner while the lower jaw
  // rotates around its hinge farther back inside the head.
  const alongJaw = smootherstep(point.x, jaw.corner, jaw.corner + .16);
  const angle = alongJaw * (lower ? -jaw.angle
    : .027 * (1 - smoothstep(point.y - jaw.lipHeight(point.x), .015, .10)));
  const reach = point.x - jaw.hinge.x;
  const height = point.y - jaw.hinge.y;
  const sin = Math.sin(angle), cos = Math.cos(angle);
  // Keep the tip within the forward reach of the closed snout.
  point.x = jaw.hinge.x + reach * cos;
  point.y = jaw.hinge.y + reach * sin + height * cos;
  normal?.set(cos * normal.x - sin * normal.y, cos * normal.y, cos * cos * normal.z).normalize();
}

function addMorph(geometry, name, toModel, deform) {
  const { position, normal } = geometry.attributes;
  const fromModel = toModel.clone().invert();
  const normalToModel = new Matrix3().getNormalMatrix(toModel);
  const normalFromModel = new Matrix3().getNormalMatrix(fromModel);
  const point = new Vector3(), direction = new Vector3(), rest = new Vector3();
  const positions = new Float32BufferAttribute(new Float32Array(position.count * 3), 3);
  const normals = new Float32BufferAttribute(new Float32Array(normal.count * 3), 3);
  positions.name = normals.name = name;
  for (let i = 0; i < position.count; i++) {
    point.fromBufferAttribute(position, i).applyMatrix4(toModel);
    direction.fromBufferAttribute(normal, i).applyMatrix3(normalToModel);
    deform(point, direction, i);
    point.applyMatrix4(fromModel).sub(rest.fromBufferAttribute(position, i));
    direction.applyMatrix3(normalFromModel).sub(rest.fromBufferAttribute(normal, i));
    positions.setXYZ(i, point.x, point.y, point.z);
    normals.setXYZ(i, direction.x, direction.y, direction.z);
  }
  geometry.morphTargetsRelative = true;
  (geometry.morphAttributes.position ??= []).push(positions);
  (geometry.morphAttributes.normal ??= []).push(normals);
}

function makeMouthInterior(head, modelToHead, jaw, lipEdges) {
  const throat = new Vector3(jaw.corner, jaw.lipHeight(jaw.corner), 0);
  const lip = new Color(0x693635);
  const recess = new Color(0x160c11);
  const positions = [], deltas = [], colors = [];
  const rest = new Vector3(), posed = new Vector3();
  function vertex(point, color, lower) {
    rest.copy(point).applyMatrix4(modelToHead);
    posed.copy(point);
    if (lower !== undefined) poseLip(posed, null, jaw, lower);
    posed.applyMatrix4(modelToHead).sub(rest);
    positions.push(rest.x, rest.y, rest.z);
    deltas.push(posed.x, posed.y, posed.z);
    colors.push(color.r, color.g, color.b);
  }
  for (const [a, b] of lipEdges) {
    if (Math.max(a.x, b.x) <= jaw.corner) continue;
    // A triangle can cross the corner plane. Keep its lining within the lip.
    if (a.x < jaw.corner) a.lerp(b, (jaw.corner - a.x) / (b.x - a.x));
    if (b.x < jaw.corner) b.lerp(a, (jaw.corner - b.x) / (a.x - b.x));
    vertex(a, lip, false);
    vertex(b, lip, false);
    vertex(throat, recess);
    vertex(b, lip, true);
    vertex(a, lip, true);
    vertex(throat, recess);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  geometry.morphTargetsRelative = true;
  geometry.morphAttributes.position = [new Float32BufferAttribute(deltas, 3)];
  geometry.computeVertexNormals();
  const interior = new Mesh(geometry, new MeshStandardMaterial({ vertexColors: true, roughness: .76, side: DoubleSide }));
  interior.name = 'Mouth interior';
  head.add(interior);
  return interior;
}

export function bindFeedingFace(object, head, jaw, gillCover) {
  const rootInverse = object.matrixWorld.clone().invert();
  const modelToHead = head.matrixWorld.clone().invert().multiply(object.matrixWorld);
  const jawMeshes = [];
  let body, interior;
  object.traverse(mesh => {
    if (!mesh.isSkinnedMesh) return;
    const isBody = mesh.name.startsWith('Body');
    const isLip = mesh.name.startsWith('Mouth_seam');
    const isBarbel = mesh.name.startsWith('Barbel');
    if (!isBody && !isLip && !isBarbel) return;
    const toModel = toModelSpace(mesh, rootInverse);
    const geometry = mesh.geometry = mesh.geometry.clone();
    const { lower, lipEdges } = isBarbel ? {} : splitLip(geometry, toModel, jaw);
    addMorph(geometry, 'JawOpen', toModel, (point, normal, i) => {
      poseLip(point, normal, jaw, isBarbel || lower[i]);
    });
    if (isBody) {
      body = mesh;
      interior = makeMouthInterior(head, modelToHead, jaw, lipEdges);
      if (gillCover) {
        addMorph(geometry, 'GillFlare', toModel, (point, normal) => {
          const rear = smoothstep(point.x, gillCover.rear - .13, gillCover.rear);
          const front = 1 - smoothstep(point.x, gillCover.hinge.x - .10, gillCover.hinge.x);
          const height = 1 - smoothstep(Math.abs(point.y - gillCover.centerY), .13, .31);
          const side = smoothstep(Math.abs(point.z), .045, .115) * Math.sign(point.z);
          const angle = gillCover.angle * rear * front * height * side;
          point.sub(gillCover.hinge).applyAxisAngle(UP, angle).add(gillCover.hinge);
          normal.applyAxisAngle(UP, angle);
        });
      }
    }
    mesh.updateMorphTargets();
    jawMeshes.push(mesh);
  });
  jawMeshes.push(interior);

  return function poseFace(time, meal, breathing = 0) {
    let gape = 0, swallow = 0;
    if (meal) {
      const { biteTime, contact } = meal;
      // The lips meet the food just before the route reaches its target.
      const release = Math.min(contact ?? Infinity, biteTime + .10);
      gape = smootherstep(time, biteTime - .32, biteTime - .13)
        * (1 - smootherstep(time, release + .012, release + .24));
      if (contact !== undefined) {
        swallow = .62 * smootherstep(time, contact + .02, contact + .16)
          * (1 - smootherstep(time, contact + .17, contact + .49));
      }
    }
    for (const mesh of jawMeshes) mesh.morphTargetInfluences[0] = gape;
    interior.visible = gape > .01;
    if (gillCover) body.morphTargetInfluences[1] = Math.min(1, breathing + swallow);
    return swallow;
  };
}
