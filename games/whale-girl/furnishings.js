import * as THREE from 'three';

const cube = new THREE.BoxGeometry();
const ball = new THREE.SphereGeometry(1, 22, 16);
const cylinder = new THREE.CylinderGeometry(1, 1, 1, 24);

export function mesh(group, geo, mat, x, y, z, sx = 1, sy = 1, sz = 1) {
  const item = new THREE.Mesh(geo, mat);
  item.position.set(x, y, z);
  item.scale.set(sx, sy, sz);
  item.castShadow = item.receiveShadow = true;
  group.add(item);
  return item;
}
export function box(g, x, y, z, w, h, d, m) {
  return mesh(g, cube, m, x, y, z, w, h, d);
}
export function orb(g, x, y, z, rx, ry, rz, m) {
  return mesh(g, ball, m, x, y, z, rx, ry, rz);
}
export function round(g, x, y, z, r, h, m, geo = cylinder) {
  return mesh(g, geo, m, x, y, z, r, h, r);
}
export function group(parent, x, y, z, yaw = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = yaw;
  parent.add(g);
  return g;
}
export function rod(g, from, to, radius, mat) {
  const a = new THREE.Vector3(...from),
    b = new THREE.Vector3(...to),
    axis = b.clone().sub(a);
  const item = round(g, (a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2, radius, axis.length(), mat);
  item.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis.normalize());
  return item;
}

const tau = Math.PI * 2;

// The same strip construction gives the gathered fabric and its sewn border matching folds.
function cloth(cols, rows, point, repeats = 1) {
  const geo = new THREE.PlaneGeometry(1, 1, cols, rows);
  const { position, uv } = geo.attributes;
  for (let y = 0; y <= rows; y++)
    for (let x = 0; x <= cols; x++) {
      const u = x / cols,
        v = y / rows,
        i = y * (cols + 1) + x;
      position.setXYZ(i, ...point(u, v));
      uv.setXY(i, u * repeats, 1 - v);
    }
  geo.computeVertexNormals();
  return geo;
}

function ribbonWing() {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.bezierCurveTo(0.07, 0.042, 0.155, 0.127, 0.197, 0.104);
  s.bezierCurveTo(0.222, 0.068, 0.213, -0.067, 0.187, -0.078);
  s.bezierCurveTo(0.14, -0.095, 0.046, -0.03, 0, 0);
  return new THREE.ExtrudeGeometry(s, {
    depth: 0.023,
    bevelEnabled: true,
    bevelSize: 0.008,
    bevelThickness: 0.01,
    bevelSegments: 2,
    curveSegments: 10,
  });
}
const bowWing = ribbonWing();
function tieBow(parent, x, y, z, m) {
  const g = group(parent, x, y, z);
  for (const side of [-1, 1]) {
    const wing = mesh(g, bowWing, m.ribbon, 0, 0, 0);
    wing.rotation.y = side < 0 ? Math.PI : 0;
    wing.rotation.z = side * 0.06;
    const tail = new THREE.Shape();
    tail.moveTo(0, -0.012);
    tail.quadraticCurveTo(0.035, -0.145, 0.102, -0.239);
    tail.lineTo(0.123, -0.204);
    tail.lineTo(0.17, -0.218);
    tail.quadraticCurveTo(0.085, -0.119, 0.048, -0.006);
    tail.closePath();
    const stream = mesh(g, new THREE.ShapeGeometry(tail), m.velvet, 0, 0, -0.008);
    stream.rotation.y = side < 0 ? Math.PI : 0;
  }
  orb(g, 0, 0.005, 0.026, 0.049, 0.047, 0.039, m.ribbon);
  orb(g, 0, 0.007, 0.063, 0.025, 0.026, 0.015, m.pearl);
}

export function dressWindows(bay, m) {
  rod(bay, [-3.69, 4.57, 0.46], [3.69, 4.57, 0.46], 0.034, m.brass);
  for (const side of [-1, 1]) {
    orb(bay, side * 3.73, 4.57, 0.46, 0.066, 0.066, 0.062, m.pearl);
    // The tie sits out over the jamb, leaving the glass and its moonlit view clear.
    function fold(u, v) {
      const gather = 1 - THREE.MathUtils.smoothstep(Math.abs(v - 0.57), 0, 0.5);
      const width = THREE.MathUtils.lerp(1.0 - 0.29 * v, 0.205, gather);
      const center = THREE.MathUtils.lerp(3.1 + 0.06 * v, 3.47, gather);
      const ripple = Math.sin(u * 2 * Math.PI * 5.5 + v * 0.45);
      return [
        side * (center + (u - 0.5) * width),
        4.48 - v * 3.42 - 0.046 * Math.sin(Math.PI * u) * v,
        0.34 + 0.076 * ripple * (1 - 0.63 * gather) + 0.044 * Math.sin(Math.PI * v),
      ];
    }
    mesh(bay, cloth(50, 25, fold), m.velvet, 0, 0, 0);
    mesh(
      bay,
      cloth(
        50,
        5,
        (u, v) => {
          const [x, y, z] = fold(u, 0.946 + 0.054 * v);
          return [x, y - 0.029 * v * (0.5 + 0.5 * Math.cos(8 * tau * u)), z + 0.008];
        },
        3
      ),
      m.lace,
      0,
      0,
      0
    );
    const [tx, ty, tz] = fold(0.5, 0.57);
    orb(bay, tx, ty, tz + 0.02, 0.14, 0.04, 0.067, m.brass);
    tieBow(bay, tx, ty, tz + 0.093, m);
  }
  const pelmet = cloth(
    162,
    9,
    (u, v) => {
      const scallop = 0.5 - 0.5 * Math.cos(u * 3 * tau);
      const eyelet = 0.5 - 0.5 * Math.cos(u * 30 * tau);
      const drop = 0.19 + 0.2 * scallop + 0.042 * eyelet;
      return [(u - 0.5) * 7.16, 4.54 - v * drop, 0.46 + 0.036 * Math.cos(u * 33 * tau) + 0.065 * v];
    },
    15
  );
  mesh(bay, pelmet, m.lace, 0, 0, 0);
}

function plushBody() {
  // Cross-sections from the rounded snout to the raised tail stock with a stitched belly seam.
  const sections = [
    [-0.37, 0.2, 0.004, 0.004],
    [-0.35, 0.205, 0.092, 0.12],
    [-0.29, 0.212, 0.153, 0.172],
    [-0.18, 0.216, 0.187, 0.19],
    [-0.035, 0.212, 0.185, 0.184],
    [0.1, 0.215, 0.153, 0.153],
    [0.205, 0.228, 0.103, 0.105],
    [0.295, 0.254, 0.059, 0.064],
    [0.365, 0.283, 0.04, 0.04],
    [0.402, 0.29, 0.02, 0.018],
  ];
  const spine = new THREE.CatmullRomCurve3(sections.map(([x, y, ry]) => new THREE.Vector3(x, y, ry)));
  const breadth = new THREE.CatmullRomCurve3(sections.map(([x, y, , rz]) => new THREE.Vector3(x, y, rz)));
  const along = 38,
    around = 48,
    positions = [],
    colors = [],
    index = [];
  const top = new THREE.Color('#627fb2'),
    sideBlue = new THREE.Color('#7792bb'),
    belly = new THREE.Color('#f0e8dd');
  for (let i = 0; i <= along; i++) {
    const v = i / along,
      s = spine.getPoint(v),
      r = breadth.getPoint(v).z;
    for (let j = 0; j <= around; j++) {
      const a = (j / around) * tau,
        level = Math.cos(a);
      positions.push(s.x, s.y + level * s.z, Math.sin(a) * r);
      const color = level < -0.22 ? belly : level < 0.34 ? sideBlue : top;
      colors.push(color.r, color.g, color.b);
      if (i < along && j < around) {
        const a0 = i * (around + 1) + j,
          b = a0 + around + 1;
        index.push(a0, a0 + 1, b, a0 + 1, b + 1, b);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setIndex(index);
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  return geo;
}
function flipper() {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.bezierCurveTo(0.05, -0.01, 0.16, -0.08, 0.2, -0.14);
  shape.bezierCurveTo(0.21, -0.18, 0.11, -0.16, 0.045, -0.11);
  shape.quadraticCurveTo(-0.02, -0.045, 0, 0);
  return new THREE.ExtrudeGeometry(shape, {
    depth: 0.025,
    bevelEnabled: true,
    bevelSize: 0.012,
    bevelThickness: 0.013,
    bevelSegments: 2,
    curveSegments: 12,
  });
}
function flukes() {
  const s = new THREE.Shape();
  s.moveTo(-0.025, 0);
  s.bezierCurveTo(0.02, 0.035, 0.08, 0.156, 0.224, 0.194);
  s.quadraticCurveTo(0.185, 0.076, 0.088, 0);
  s.quadraticCurveTo(0.181, -0.07, 0.224, -0.187);
  s.bezierCurveTo(0.085, -0.155, 0.024, -0.047, -0.025, 0);
  return new THREE.ExtrudeGeometry(s, {
    depth: 0.016,
    bevelEnabled: true,
    bevelThickness: 0.014,
    bevelSize: 0.01,
    bevelSegments: 2,
    curveSegments: 14,
  });
}
export function whaleCushion(parent, m) {
  const g = group(parent, 0.91, 0.437, 0.038, 0.41);
  g.scale.setScalar(0.99);
  mesh(g, plushBody(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }), 0, 0, 0);
  const fin = flipper();
  for (const side of [-1, 1]) {
    const eyeZ = 0.166 * side;
    orb(g, -0.274, 0.246, eyeZ, 0.028, 0.03, 0.015, m.whaleEye);
    orb(g, -0.282, 0.255, eyeZ + 0.012 * side, 0.007, 0.007, 0.004, m.pearl);
    orb(g, -0.242, 0.191, 0.181 * side, 0.032, 0.012, 0.007, m.terra);
    const paddle = mesh(g, fin, m.whale, 0.005, 0.188, 0.158 * side);
    paddle.rotation.x = -side * 0.59;
    for (let i = 0; i < 4; i++) {
      const x = -0.095 + 0.038 * i;
      rod(g, [x, 0.168, 0.181 * side], [x + 0.018, 0.169, 0.182 * side], 0.0028, m.piping);
    }
  }
  const tail = mesh(g, flukes(), m.whale, 0.356, 0.279, 0);
  tail.rotation.x = Math.PI / 2;
  tail.rotation.z = 0.09;
}

const shadeGeometry = (() => {
  const profile = [
    [0.036, 0.23],
    [0.09, 0.216],
    [0.126, 0.182],
    [0.148, 0.124],
    [0.173, 0.078],
    [0.236, 0.038],
    [0.279, 0.007],
    [0.29, -0.018],
  ];
  const geo = new THREE.LatheGeometry(
    profile.map(([r, y]) => new THREE.Vector2(r, y)),
    88
  );
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i),
      y = p.getY(i),
      z = p.getZ(i),
      angle = Math.atan2(x, z);
    const flare = THREE.MathUtils.smoothstep(0.24 - y, 0, 0.25);
    const petal = 0.5 + 0.5 * Math.cos(11 * angle);
    const radius = 1 + 0.072 * petal * flare;
    p.setXYZ(i, x * radius, y - 0.052 * petal * flare * flare, z * radius);
  }
  geo.computeVertexNormals();
  return geo;
})();
export function opalShade(g, m, scale = 1) {
  const s = group(g, 0, 0, 0);
  s.scale.setScalar(scale);
  mesh(s, shadeGeometry, m.opal, 0, 0, 0);
  round(s, 0, 0.226, 0, 0.055, 0.041, m.brass);
  orb(s, 0, 0.014, 0, 0.09, 0.108, 0.09, m.glow);
}

export function shellNightLight(bay, m) {
  const lamp = group(bay, -1.08, 1.128, 0.174, 0.21);
  const nacre = new THREE.MeshStandardMaterial({
    color: '#e3bfc0',
    emissive: '#de9b91',
    emissiveIntensity: 0.07,
    metalness: 0.22,
    roughness: 0.38,
    side: THREE.DoubleSide,
  });
  // Both valves fan out from the same hinge. The ribs continue into the scalloped lip.
  const valve = cloth(108, 19, (u, v) => {
    const theta = (2 * u - 1) * 1.27;
    const rib = 0.5 + 0.5 * Math.cos(12 * tau * u);
    const r = 0.035 + v * (0.91 + 0.055 * rib);
    return [0.354 * r * Math.sin(theta), 0.38 * r * Math.cos(theta), 0.108 * r * r + 0.024 * r * rib];
  });
  orb(lamp, 0, 0.023, 0.096, 0.158, 0.023, 0.107, m.brass);
  mesh(lamp, valve, nacre, 0, 0.037, 0);
  const lower = mesh(lamp, valve, nacre, 0, 0.042, 0.004, 0.94, 0.69, 0.54);
  lower.rotation.set(-1.53, Math.PI, 0, 'YXZ');
  const pearl = new THREE.MeshStandardMaterial({
    color: '#f9e9d5',
    emissive: '#ffe3ad',
    emissiveIntensity: 0.41,
    roughness: 0.26,
  });
  orb(lamp, 0, 0.14, 0.113, 0.079, 0.083, 0.079, pearl);
  const glow = new THREE.PointLight(0xffcdab, 0.24, 3.1, 2);
  glow.position.set(0.04, 0.23, 0.41);
  lamp.add(glow);
}

export function moonChime(scene, m) {
  const g = group(scene, -1.68, 4.55, -4.05, -0.12);
  const crescent = new THREE.Shape();
  crescent.moveTo(0.075, 0.118);
  crescent.bezierCurveTo(-0.14, 0.126, -0.19, -0.108, -0.014, -0.142);
  crescent.bezierCurveTo(0.057, -0.152, 0.13, -0.104, 0.142, -0.044);
  crescent.bezierCurveTo(-0.005, -0.136, -0.078, 0.047, 0.075, 0.118);
  rod(g, [0, 0, 0], [0, -0.44, 0], 0.006, m.brass);
  mesh(
    g,
    new THREE.ExtrudeGeometry(crescent, {
      depth: 0.022,
      bevelEnabled: true,
      bevelSize: 0.006,
      bevelThickness: 0.008,
      bevelSegments: 2,
      curveSegments: 16,
    }),
    m.brass,
    0,
    -0.54,
    0
  );
  for (const [x, top, len] of [
    [-0.09, -0.6, 0.17],
    [0.004, -0.685, 0.2],
    [0.095, -0.62, 0.12],
  ]) {
    rod(g, [x, top, 0], [x, top - len, 0], 0.004, m.brass);
    orb(g, x, top - len - 0.026, 0, 0.017, 0.034, 0.016, m.pearl);
  }
  return g;
}
