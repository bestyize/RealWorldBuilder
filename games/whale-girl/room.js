import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import harborUrl from './moonrise-harbor.jpg';
import rugUrl from './whale-tapestry.jpg';
import {
  mesh,
  box,
  orb,
  round,
  group,
  rod,
  dressWindows,
  whaleCushion,
  opalShade,
  moonChime,
  shellNightLight,
} from './furnishings.js';
import {
  paintedTexture,
  woodGrain,
  parquet,
  wallpaper,
  lace,
  tideNotes,
  letterPaper,
  seaChart,
  globePaper,
} from './surfaces.js';

// Clear aisles run between the inner edges of the wall furniture.
export const floorLimits = { left: -4.85, right: 4.24, back: -3.29, front: 3.9 };
const deskHeightScale = 0.72;
export const stations = {
  seat: {
    approach: [0, -3.29],
    pose: [0, 0.308, -4.0],
    yaw: 0.08,
    hit: [
      [-1.48, 0.05, -4.53],
      [1.48, 0.94, -3.8],
    ],
    clip: 'bench-read',
  },
  desk: {
    paperY: 0.88 * deskHeightScale,
    approach: [4.24, -1.15],
    pose: [4.48, 0.008, -0.86],
    yaw: -0.4,
    hit: [
      [4.46, 0.06, -0.56],
      [5.58, 1.58, 2.35],
    ],
    clip: 'write',
  },
};

const flare = new THREE.CylinderGeometry(0.69, 1, 1, 32);
const flowerpot = new THREE.CylinderGeometry(1, 0.7, 1, 28);
const ring = new THREE.TorusGeometry(1, 0.038, 8, 64);
const pillow = new RoundedBoxGeometry(0.4, 0.34, 0.16, 3, 0.068);
const leafGeo = new THREE.PlaneGeometry(1, 1, 2, 10);
// Fold along the central vein and let the tip of each blade fall outwards.
const leafVertices = leafGeo.attributes.position;
for (let i = 0; i < leafVertices.count; i++) {
  const t = leafVertices.getY(i) + 0.5,
    side = leafVertices.getX(i);
  const width = Math.max(0.009, Math.sin(t * Math.PI) ** 0.75);
  leafVertices.setXYZ(
    i,
    side * width,
    t - t ** 3 * 0.3,
    t * t * 0.75 + (1 - Math.abs(side) * 2) * width * 0.11
  );
}
leafGeo.computeVertexNormals();

function plane(g, w, h, m, x, y, z) {
  return mesh(g, new THREE.PlaneGeometry(w, h), m, x, y, z);
}
function floorPlane(g, w, d, m, x, y, z) {
  const item = plane(g, w, d, m, x, y, z);
  item.rotation.x = -Math.PI / 2;
  item.castShadow = false;
  return item;
}

function palette() {
  const grain = woodGrain();
  const mat = (color, map = null) => new THREE.MeshStandardMaterial({ color, map, roughness: 0.82 });
  const metal = (color, metalness = 0.48) =>
    new THREE.MeshStandardMaterial({ color, metalness, roughness: 0.34 });
  return {
    plaster: mat('#fffcff', wallpaper()),
    ceiling: mat('#dce3ed'),
    panelling: mat('#617e9b', grain),
    inset: mat('#91a8c0', grain),
    dark: mat('#50566c', grain),
    walnut: mat('#917f83', grain),
    oak: mat('#bba99b', grain),
    honey: mat('#e3d5be', grain),
    ivory: mat('#f1e9e7', grain),
    brass: metal('#bc9052'),
    gilt: metal('#d8ba79', 0.23),
    cushion: mat('#5c7398'),
    piping: mat('#e3dbe1'),
    terra: mat('#b7949f'),
    ceramic: mat('#dce1ef'),
    leaves: ['#385e4c', '#538062', '#75916b'].map(
      (color) => new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide, roughness: 0.74 })
    ),
    lamp: metal('#475e82', 0.18),
    glow: new THREE.MeshBasicMaterial({ color: '#fff0d0' }),
    ink: mat('#344566'),
    page: mat('#f3e6d4'),
    casePaint: mat('#cbd7e5', grain),
    velvet: new THREE.MeshStandardMaterial({ color: '#7388b6', roughness: 0.95, side: THREE.DoubleSide }),
    ribbon: mat('#3c5383'),
    lace: new THREE.MeshStandardMaterial({
      map: lace(),
      color: '#fff9ed',
      alphaTest: 0.42,
      side: THREE.DoubleSide,
      roughness: 0.91,
    }),
    pearl: new THREE.MeshStandardMaterial({ color: '#fff3e6', metalness: 0.2, roughness: 0.26 }),
    opal: new THREE.MeshStandardMaterial({
      color: '#f5e4df',
      emissive: '#ffe1bc',
      emissiveIntensity: 0.49,
      roughness: 0.34,
      side: THREE.DoubleSide,
    }),
    whale: mat('#617ba9'),
    whaleEye: metal('#202844', 0.12),
    notes: mat('#fcf7f2', tideNotes()),
    letter: mat('#ffffff', letterPaper()),
    books: [
      '#71869c',
      '#997887',
      '#b5a084',
      '#536c90',
      '#929d9c',
      '#c6b1a6',
      '#8a83a5',
      '#658293',
      '#ae8890',
    ].map((c) => mat(c)),
    chart: mat('#fff8e0', seaChart()),
    globe: mat('#ffffff', globePaper()),
  };
}

// Bake shared shapes into instances so the book spines and mouldings stay inexpensive to draw.
function batchRoom(root) {
  root.updateMatrixWorld(true);
  const batches = new Map();
  root.traverse((item) => {
    if (!item.isMesh || item.material.transparent) return;
    const key = [item.geometry.uuid, item.material.uuid, item.castShadow, item.receiveShadow].join('|');
    if (!batches.has(key)) batches.set(key, []);
    batches.get(key).push(item);
  });
  for (const items of batches.values()) {
    if (items.length < 2) continue;
    const first = items[0],
      batch = new THREE.InstancedMesh(first.geometry, first.material, items.length);
    batch.castShadow = first.castShadow;
    batch.receiveShadow = first.receiveShadow;
    items.forEach((item, i) => {
      batch.setMatrixAt(i, item.matrixWorld);
      item.removeFromParent();
    });
    batch.computeBoundingSphere();
    root.add(batch);
  }
}

function panelWall(g, w, end, m) {
  const height = 5.02;
  const plaster = box(g, 0, height / 2, -0.12, w, height, 0.22, m.plaster);
  plaster.castShadow = false;
  box(g, 0, 0.58, 0.008, w, 1.16, 0.085, m.panelling);
  const bays = Math.ceil(w / 1.14),
    step = w / bays;
  for (let i = 0; i < bays; i++) {
    const x = (i + 0.5) * step - w / 2;
    box(g, x, 0.58, 0.059, step - 0.11, 0.87, 0.024, m.inset);
    for (const side of [-1, 1])
      box(g, x + side * (step / 2 - 0.085), 0.58, 0.078, 0.022, 0.89, 0.018, m.panelling);
    for (const y of [0.15, 1.01]) box(g, x, y, 0.078, step - 0.15, 0.027, 0.021, m.panelling);
  }
  for (const [y, h, d, mat] of [
    [0.1, 0.19, 0.15, m.dark],
    [0.2, 0.045, 0.13, m.oak],
    [1.13, 0.12, 0.17, m.walnut],
    [1.21, 0.043, 0.2, m.honey],
    [4.66, 0.13, 0.18, m.walnut],
    [4.78, 0.11, 0.28, m.oak],
    [4.88, 0.085, 0.36, m.dark],
  ]) {
    box(g, 0, y, 0.06, w, h, d, mat);
  }
  if (end) for (const x of [-w / 2 + 0.13, w / 2 - 0.13]) box(g, x, 2.91, 0.065, 0.17, 3.47, 0.13, m.ivory);
}

function arch(g, x, bottom, z, w, h, mat, uvRange) {
  const r = w / 2,
    spring = h - r,
    shape = new THREE.Shape();
  shape.moveTo(-r, 0);
  shape.lineTo(r, 0);
  shape.lineTo(r, spring);
  shape.absarc(0, spring, r, 0, Math.PI, false);
  shape.closePath();
  const geo = new THREE.ShapeGeometry(shape, 36);
  if (uvRange) {
    const pos = geo.attributes.position,
      uv = geo.attributes.uv;
    for (let i = 0; i < pos.count; i++)
      uv.setXY(i, uvRange[0] + (pos.getX(i) / w + 0.5) * uvRange[1], pos.getY(i) / h);
  }
  const item = mesh(g, geo, mat, x, bottom, z);
  item.castShadow = false;
  return item;
}
function windows(g, m, harbor) {
  const sky = new THREE.MeshBasicMaterial({ map: harbor, toneMapped: false });
  for (const x of [-2.38, 0, 2.38]) {
    arch(g, x, 0.96, 0.1, 2.35, 3.52, m.walnut);
    arch(g, x, 1.015, 0.115, 2.25, 3.4, m.honey);
    arch(g, x, 1.072, 0.13, 2.12, 3.29, m.dark);
    const w = 2.035,
      h = 3.2,
      b = 1.105,
      spring = b + h - w / 2;
    arch(g, x, b, 0.145, w, h, sky, [(x + 3.3975) / 6.795, w / 6.795]);
    box(g, x, (b + spring) / 2, 0.168, 0.042, spring - b, 0.05, m.honey);
    box(g, x, spring, 0.17, w, 0.048, 0.055, m.honey);
    for (const side of [-1, 1])
      rod(g, [x, spring, 0.17], [x + side * w * 0.35355, spring + w * 0.35355, 0.17], 0.017, m.honey);
    box(g, x, 1.88, 0.169, w, 0.035, 0.043, m.honey);
    box(g, x, 1.056, 0.139, 2.36, 0.105, 0.34, m.walnut);
    box(g, x, 1.1, 0.15, 2.38, 0.051, 0.42, m.honey);
    box(g, x, 4.41, 0.155, 0.14, 0.18, 0.08, m.ivory);
  }
}

function book(g, x, y, z, w, h, d, cover, m, angle = 0) {
  const volume = group(g, x, y, z);
  volume.rotation.z = angle;
  box(volume, 0, h / 2, 0, w, h, d, cover);
  for (const ry of [0.18, 0.78, 0.84]) box(volume, 0, h * ry, d / 2 + 0.002, w * 0.85, 0.01, 0.005, m.gilt);
  if (w > 0.12) box(volume, 0, h * 0.59, d / 2 + 0.003, w * 0.57, 0.039, 0.006, m.page);
}
function flatBook(g, x, y, z, width, depth, height, yaw, cover, m) {
  const stack = group(g, x, y, z, yaw);
  box(stack, 0, 0, 0, width - 0.023, height - 0.015, depth - 0.018, m.page);
  for (const side of [-1, 1]) box(stack, 0, side * (height / 2 - 0.005), 0, width, 0.01, depth, cover);
  box(stack, 0, 0, depth / 2 - 0.007, width, height, 0.016, cover);
  for (const side of [-1, 1])
    box(stack, side * width * 0.33, 0, depth / 2 + 0.002, 0.01, height * 0.73, 0.004, m.gilt);
}
function bookcase(g, m, w, seed) {
  const rows = 5,
    base = 0.72,
    pitch = 0.53,
    top = base + rows * pitch;
  box(g, 0, top / 2, -0.16, w, top, 0.12, m.dark);
  box(g, 0, 0.34, 0.012, w, 0.64, 0.5, m.panelling);
  for (const side of [-1, 1]) {
    const x = side * w * 0.24;
    box(g, x, 0.34, 0.286, w * 0.42, 0.415, 0.03, m.inset);
    box(g, x, 0.34, 0.31, w * 0.35, 0.315, 0.018, m.panelling);
    orb(g, x - side * w * 0.115, 0.39, 0.346, 0.024, 0.023, 0.024, m.brass);
    box(g, side * (w / 2 - 0.045), top / 2, 0.02, 0.095, top, 0.49, m.casePaint);
    box(g, side * (w / 2 - 0.047), top / 2, 0.284, 0.068, top, 0.035, m.honey);
  }
  for (let r = 0; r <= rows; r++) {
    const y = base + r * pitch;
    box(g, 0, y, 0.01, w, 0.065, 0.5, m.honey);
    box(g, 0, y - 0.023, 0.278, w, 0.04, 0.042, m.casePaint);
    if (r === rows) continue;
    let cursor = -w / 2 + 0.115,
      i = 0;
    const stack = (seed + r) % 3 !== 1;
    const end = w / 2 - 0.09 - (stack ? 0.58 : 0);
    if (stack) {
      const count = 2 + ((seed + r) % 3);
      for (let layer = 0; layer < count; layer++) {
        const width = 0.46 - ((seed + r + layer) % 3) * 0.038;
        flatBook(
          g,
          w / 2 - 0.33,
          y + 0.074 + layer * 0.071,
          0.095,
          width,
          0.295,
          0.068,
          0.055 * (((seed + layer) % 4) - 1.5),
          m.books[(seed + r + layer) % m.books.length],
          m
        );
      }
    }
    while (cursor < end - 0.08) {
      const k = (seed * 5 + r * 23 + i * 17) % 43;
      const width = 0.075 + (k % 7) * 0.013,
        height = 0.285 + (k % 8) * 0.02;
      if (i === 3 && (seed + r) % 3 === 0) cursor += 0.13;
      if (cursor + width > end) break;
      book(
        g,
        cursor + width / 2,
        y + 0.036,
        0.083 + (k % 3) * 0.012,
        width,
        height,
        0.26 + (k % 4) * 0.02,
        m.books[k % m.books.length],
        m,
        i === 2 && r % 2 === 1 ? -0.085 : 0
      );
      cursor += width + 0.012;
      i++;
    }
  }
  box(g, 0, 0.09, 0.04, w + 0.055, 0.15, 0.57, m.casePaint);
  box(g, 0, top + 0.1, 0.015, w + 0.11, 0.14, 0.6, m.panelling);
  box(g, 0, top + 0.178, 0.02, w + 0.16, 0.045, 0.64, m.honey);
}

function frame(g, x, y, w, h, m, art) {
  box(g, x, y, 0.102, w + 0.14, h + 0.14, 0.09, m.walnut);
  box(g, x, y, 0.157, w + 0.06, h + 0.06, 0.044, m.gilt);
  plane(g, w, h, art, x, y, 0.185);
}
function door(g, m) {
  arch(g, 0, 0.015, 0.12, 1.84, 3.28, m.walnut);
  arch(g, 0, 0.045, 0.14, 1.71, 3.14, m.honey);
  arch(g, 0, 0.08, 0.155, 1.56, 3.0, m.inset);
  for (const x of [-0.37, 0.37])
    for (const [y, h] of [
      [0.68, 0.86],
      [1.93, 1.25],
    ]) {
      box(g, x, y, 0.174, 0.6, h, 0.04, m.panelling);
      box(g, x, y, 0.209, 0.49, h - 0.13, 0.035, m.inset);
    }
  box(g, 0, 2.61, 0.195, 1.53, 0.065, 0.08, m.oak);
  box(g, 0.57, 1.04, 0.229, 0.075, 0.23, 0.037, m.brass);
  orb(g, 0.57, 1.07, 0.285, 0.055, 0.055, 0.06, m.gilt);
  box(g, 0, 0.023, 0.26, 1.85, 0.046, 0.58, m.oak);
}

function ladder(g, m) {
  for (const side of [-1, 1]) {
    rod(g, [side * 0.26, 0.13, 0.79], [side * 0.26, 2.57, 0.32], 0.041, m.honey);
    const wheel = round(g, side * 0.26, 0.095, 0.78, 0.084, 0.05, m.dark);
    wheel.rotation.z = Math.PI / 2;
  }
  for (let i = 0; i < 8; i++) {
    const t = i / 8 + 0.06;
    rod(
      g,
      [-0.25, 0.13 + 2.44 * t, 0.79 - 0.47 * t],
      [0.25, 0.13 + 2.44 * t, 0.79 - 0.47 * t],
      0.031,
      m.oak
    );
  }
}

function bench(g, m) {
  for (const x of [-1.22, 1.22]) {
    for (const z of [-0.19, 0.19]) box(g, x, 0.19, z, 0.1, 0.38, 0.1, m.walnut);
    box(g, x, 0.61, -0.235, 0.074, 0.51, 0.068, m.walnut);
    box(g, x, 0.535, 0, 0.095, 0.065, 0.48, m.honey);
  }
  box(g, 0, 0.26, 0.01, 2.62, 0.15, 0.5, m.walnut);
  box(g, 0, 0.358, 0, 2.74, 0.083, 0.57, m.honey);
  mesh(g, new RoundedBoxGeometry(2.69, 0.075, 0.52, 3, 0.032), m.cushion, 0, 0.412, 0.012);
  box(g, 0, 0.403, 0.27, 2.61, 0.012, 0.009, m.piping);
  mesh(g, new RoundedBoxGeometry(2.51, 0.25, 0.105, 3, 0.047), m.velvet, 0, 0.71, -0.244);
  box(g, 0, 0.836, -0.247, 2.54, 0.035, 0.08, m.casePaint);
  const cushion = mesh(g, pillow, m.terra, -1.02, 0.59, -0.105);
  cushion.rotation.set(-0.16, 0, -0.17);
  orb(cushion, 0, 0, 0.083, 0.017, 0.017, 0.009, m.piping);
  whaleCushion(g, m);
}

function plant(g, m, scale) {
  g.scale.setScalar(scale);
  round(g, 0, 0.23, 0, 0.27, 0.44, m.terra, flowerpot);
  round(g, 0, 0.44, 0, 0.28, 0.064, m.oak);
  round(g, 0, 0.476, 0, 0.247, 0.012, m.dark);
  round(g, 0, 0.38, 0, 0.256, 0.016, m.honey);
  for (let i = 0; i < 17; i++) {
    const a = i * 2.4,
      spread = 0.2 + (i % 4) * 0.065,
      h = 0.48 + (i % 3) * 0.16;
    const x = Math.cos(a) * spread,
      z = Math.sin(a) * spread;
    const stemHeight = 0.43 + h * 0.52;
    rod(g, [0, 0.46, 0], [x * 0.56, stemHeight, z * 0.56], 0.009, m.leaves[0]);
    const blade = mesh(
      g,
      leafGeo,
      m.leaves[i % 3],
      x * 0.56,
      stemHeight,
      z * 0.56,
      0.12 + (i % 3) * 0.033,
      h * 0.81,
      spread * 0.89
    );
    blade.rotation.set(0, Math.PI / 2 - a, 0);
  }
}
function globe(g, m) {
  round(g, 0, 0.06, 0, 0.31, 0.12, m.walnut, flare);
  round(g, 0, 0.15, 0, 0.2, 0.1, m.brass, flare);
  round(g, 0, 0.44, 0, 0.067, 0.57, m.walnut);
  orb(g, 0, 0.64, 0, 0.12, 0.16, 0.12, m.oak);
  round(g, 0, 0.77, 0, 0.23, 0.051, m.brass);
  const world = group(g, 0, 1.22, 0);
  world.rotation.z = -0.29;
  orb(world, 0, 0, 0, 0.401, 0.401, 0.401, m.globe).rotation.y = -1.9;
  const meridian = mesh(world, ring, m.brass, 0, 0, 0, 0.453, 0.453, 0.453);
  meridian.rotation.y = -0.35;
  for (const y of [-0.426, 0.426]) orb(world, 0, y, 0, 0.034, 0.041, 0.034, m.gilt);
}
function modelYacht(g, m) {
  box(g, 0, 0.035, 0, 0.77, 0.07, 0.26, m.walnut);
  for (const x of [-0.24, 0.24]) round(g, x, 0.105, 0, 0.022, 0.1, m.brass);
  const hull = new THREE.Shape();
  hull.moveTo(-0.67, 0.25);
  hull.quadraticCurveTo(-0.47, 0.085, 0.16, 0.12);
  hull.quadraticCurveTo(0.48, 0.13, 0.68, 0.32);
  hull.quadraticCurveTo(0.06, 0.215, -0.67, 0.25);
  const body = new THREE.ExtrudeGeometry(hull, {
    depth: 0.11,
    bevelEnabled: true,
    bevelSegments: 2,
    steps: 1,
    bevelSize: 0.018,
    bevelThickness: 0.028,
  });
  mesh(g, body, m.ink, 0, 0, -0.055);
  rod(g, [-0.61, 0.254, 0.078], [0.48, 0.268, 0.078], 0.009, m.brass);
  rod(g, [-0.04, 0.23, 0], [-0.04, 1.04, 0], 0.018, m.honey);
  rod(g, [-0.45, 0.33, 0], [-0.03, 0.33, 0], 0.013, m.walnut);
  function sail(a, b, c, mat) {
    const vertices = new Float32Array([
      ...a,
      ...b,
      ...c,
      (a[0] + b[0] + c[0]) / 3,
      (a[1] + b[1] + c[1]) / 3,
      0.073,
    ]);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geo.setIndex([0, 1, 3, 1, 2, 3, 2, 0, 3]);
    geo.computeVertexNormals();
    mesh(g, geo, mat, 0, 0, 0);
  }
  const linen = m.page.clone();
  linen.side = THREE.DoubleSide;
  sail([-0.07, 0.97, 0], [-0.49, 0.354, 0], [-0.07, 0.344, 0], linen);
  sail([-0.005, 0.92, 0], [0.04, 0.36, 0], [0.55, 0.33, 0], linen);
  rod(g, [-0.04, 1.01, 0], [0.64, 0.32, 0], 0.005, m.piping);
  rod(g, [-0.04, 0.99, 0], [-0.61, 0.27, 0], 0.005, m.piping);
}
function teaTable(g, m) {
  round(g, 0, 0.07, 0, 0.25, 0.08, m.walnut, flare);
  round(g, 0, 0.34, 0, 0.06, 0.53, m.oak);
  round(g, 0, 0.63, 0, 0.42, 0.077, m.walnut);
  round(g, 0, 0.675, 0, 0.405, 0.025, m.honey);
  round(g, -0.13, 0.7, 0.07, 0.092, 0.014, m.ceramic);
  round(g, -0.13, 0.758, 0.07, 0.063, 0.1, m.ceramic, flowerpot);
  round(g, -0.13, 0.807, 0.07, 0.064, 0.011, m.ribbon);
  round(g, -0.13, 0.813, 0.07, 0.053, 0.005, m.walnut);
  mesh(g, ring, m.ceramic, -0.058, 0.766, 0.07, 0.033, 0.033, 0.033);
  orb(g, 0.095, 0.79, -0.08, 0.1, 0.111, 0.09, m.ceramic);
  for (let i = 0; i < 5; i++) {
    const x = 0.094 + Math.cos(i * 2.4) * 0.1,
      z = -0.08 + Math.sin(i * 2.4) * 0.07,
      y = 1.03 + (i % 3) * 0.06;
    rod(g, [0.09, 0.86, -0.08], [x, y, z], 0.009, m.leaves[0]);
    for (let k = 0; k < 5; k++)
      orb(
        g,
        x + 0.023 * Math.cos(k * 1.256),
        y,
        z + 0.023 * Math.sin(k * 1.256),
        0.026,
        0.015,
        0.025,
        m.page
      );
    orb(g, x, y + 0.008, z, 0.017, 0.012, 0.017, m.brass);
  }
}
function desk(g, m) {
  g.scale.y = deskHeightScale;
  for (const x of [-1.21, 1.21])
    for (const z of [-0.39, 0.39]) {
      box(g, x, 0.4, z, 0.095, 0.8, 0.095, m.walnut);
      box(g, x, 0.12, z, 0.118, 0.056, 0.118, m.brass);
    }
  box(g, 0, 0.71, -0.05, 2.58, 0.18, 0.81, m.walnut);
  for (const x of [-0.87, 0, 0.87]) {
    box(g, x, 0.719, 0.38, 0.79, 0.122, 0.044, m.oak);
    rod(g, [x - 0.085, 0.725, 0.42], [x + 0.085, 0.725, 0.42], 0.013, m.brass);
  }
  box(g, 0, 0.809, 0, 2.88, 0.076, 1.07, m.oak);
  box(g, 0, 0.851, 0, 2.84, 0.018, 1.045, m.honey);
  box(g, -0.73, 0.866, 0.13, 1.34, 0.012, 0.69, m.cushion);
  const letter = group(g, -1.235, 0.876, 0.3, -0.08);
  box(letter, 0, 0, 0, 0.365, 0.007, 0.3, m.page);
  const note = floorPlane(letter, 0.294, 0.359, m.letter, 0, 0.0045, 0);
  note.rotation.z = -Math.PI / 2;
  const envelope = group(g, 0.42, 0.866, 0.2, 0.14);
  box(envelope, 0, 0.006, 0, 0.36, 0.012, 0.23, m.page);
  for (const side of [-1, 1])
    rod(envelope, [side * 0.175, 0.015, -0.107], [0, 0.016, 0.035], 0.003, m.piping);
  round(envelope, 0, 0.021, 0.029, 0.031, 0.012, m.ribbon);
  orb(envelope, 0, 0.028, 0.029, 0.012, 0.003, 0.012, m.gilt);
  for (let i = 0; i < 3; i++) {
    flatBook(g, 1.0, 0.904 + i * 0.086, -0.1, 0.52, 0.35, 0.086, 0.1 * (i - 1), m.books[(i + 2) * 2], m);
  }
  round(g, 0.52, 0.926, -0.18, 0.075, 0.12, m.ink, flowerpot);
  for (let i = 0; i < 3; i++)
    rod(g, [0.51, 0.94, -0.18], [0.46 + 0.052 * i, 1.16 + i * 0.015, -0.21 + 0.02 * i], 0.009, m.brass);
  // Opal reading light with a brass stem and a pearl pull.
  const lamp = group(g, -0.37, 0.86, -0.32, Math.PI / 2 - 0.18);
  orb(lamp, 0, 0.034, 0, 0.235, 0.048, 0.15, m.lamp);
  round(lamp, 0, 0.084, 0, 0.11, 0.043, m.brass);
  round(lamp, 0, 0.3, 0, 0.028, 0.43, m.brass);
  rod(lamp, [0, 0.43, 0], [0.07, 0.62, 0], 0.023, m.brass);
  rod(lamp, [0.07, 0.62, 0], [0.18, 0.62, 0], 0.021, m.brass);
  opalShade(group(lamp, 0.18, 0.457, 0), m, 0.72);
  const bulb = new THREE.PointLight(0xffce9e, 0.54, 3.5, 2);
  bulb.position.set(0.18, 0.421, 0.065);
  lamp.add(bulb);
  rod(lamp, [0.26, 0.5, 0.01], [0.26, 0.31, 0.01], 0.005, m.brass);
  orb(lamp, 0.26, 0.3, 0.01, 0.016, 0.021, 0.016, m.pearl);
}
function pendant(g, m) {
  round(g, 0, 4.88, 0, 0.115, 0.046, m.brass, flare);
  round(g, 0, 4.54, 0, 0.01, 0.66, m.dark);
  orb(g, 0, 4.19, 0, 0.043, 0.066, 0.043, m.pearl);
  round(g, 0, 4.12, 0, 0.027, 0.065, m.brass);
  opalShade(group(g, 0, 3.86, 0), m, 1.1);
  const bulb = new THREE.PointLight(0xffd5a8, 6.4, 7.8, 2);
  bulb.position.set(0, 3.77, 0);
  g.add(bulb);
}

function floorLight() {
  const map = paintedTexture(640, 640, (c) => {
    c.filter = 'blur(8px)';
    c.transform(1, 0, -0.26, 1, 151, 0);
    const fade = c.createLinearGradient(0, 0, 0, 620);
    fade.addColorStop(0, '#d7eaffac');
    fade.addColorStop(0.35, '#bbd7ff82');
    fade.addColorStop(1, '#bccff508');
    c.fillStyle = fade;
    for (let i = 0; i < 3; i++) {
      const x = 20 + i * 158;
      for (const [y, h] of [
        [14, 104],
        [130, 170],
        [315, 270],
      ])
        for (let k = 0; k < 2; k++) c.fillRect(x + k * 68, y, 62, h);
    }
  });
  return new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, opacity: 0.4 });
}

export async function createRoom(scene) {
  const root = new THREE.Group();
  scene.add(root);
  const m = palette(),
    loader = new THREE.TextureLoader();
  const [harbor, tapestry] = await Promise.all([loader.loadAsync(harborUrl), loader.loadAsync(rugUrl)]);
  for (const map of [harbor, tapestry]) {
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 8;
  }
  harbor.repeat.x = 6.795 / 3.2 / (harbor.image.width / harbor.image.height);
  harbor.offset.x = (1 - harbor.repeat.x) * 0.12;
  const floor = new THREE.MeshStandardMaterial({ map: parquet(), roughness: 0.84 });
  floorPlane(root, 12.5, 17.5, floor, 0, 0, 4.0);
  const back = group(root, 0, 0, -4.66),
    left = group(root, -6.18, 0, 4, Math.PI / 2),
    right = group(root, 6.18, 0, 4, -Math.PI / 2);
  panelWall(back, 12.44, true, m);
  panelWall(left, 17.54, false, m);
  panelWall(right, 17.54, false, m);
  const roof = group(root, 0, 0, 0);
  const ceiling = plane(roof, 12.46, 17.5, m.ceiling, 0, 5, 4);
  ceiling.rotation.x = Math.PI / 2;
  for (const z of [-4.46, -1.95, 0.58, 3.1, 5.63, 8.16, 10.69, 12.63]) {
    box(roof, 0, 4.9, z, 12.38, 0.16, 0.18, m.walnut);
    box(roof, 0, 4.8, z, 12.38, 0.045, 0.21, m.honey);
  }
  for (const x of [-5.8, -3.56, 0, 3.56, 5.8]) box(roof, x, 4.936, 4, 0.11, 0.1, 17.5, m.oak);
  for (const x of [-3.55, 3.55]) pendant(group(roof, x, 0, -0.3), m);
  roof.traverse((part) => {
    part.castShadow = false;
  });
  const bay = group(back, 0, 0, 0.15);
  windows(bay, m, harbor);
  dressWindows(bay, m);
  shellNightLight(bay, m);
  for (const [x, seed] of [
    [-4.92, 3],
    [4.92, 8],
  ])
    bookcase(group(root, x, 0, -4.29), m, 2.12, seed);
  for (const [z, seed] of [
    [-2.62, 5],
    [-0.54, 9],
  ])
    bookcase(group(root, -5.84, 0, z, Math.PI / 2), m, 1.97, seed);
  ladder(group(root, -5.83, 0, -1.86, Math.PI / 2), m);
  modelYacht(group(root, 4.9, 3.57, -4.31, -0.05), m);
  plant(group(root, -4.8, 3.57, -4.3), m, 0.58);
  door(group(root, -6.17, 0, 2.48, Math.PI / 2), m);
  frame(right, -5.3, 2.65, 2.22, 1.55, m, m.notes);
  frame(left, -0.94, 2.49, 0.99, 0.71, m, m.chart);
  for (const x of [-3.58, 3.58]) {
    round(back, x, 3.04, 0.15, 0.105, 0.18, m.brass);
    rod(back, [x, 3.04, 0.15], [x, 3.13, 0.37], 0.034, m.walnut);
    orb(back, x, 3.26, 0.37, 0.11, 0.15, 0.11, m.glow);
    round(back, x, 3.4, 0.37, 0.145, 0.075, m.brass, flare);
  }
  bench(group(root, 0, 0, -4.12), m);
  teaTable(group(root, 2.06, 0, -4.14), m);
  plant(group(root, -2.47, 0, -4.16), m, 1.24);
  globe(group(root, 3.28, 0, -4.05), m);
  desk(group(root, 5.0, 0, 0.88, -Math.PI / 2), m);
  plant(group(root, 5.59, 0, 4.58), m, 1.15);

  const rugM = new THREE.MeshStandardMaterial({ map: tapestry, roughness: 1 });
  floorPlane(root, 6.42, 3.52, rugM, -0.19, 0.008, 0.69);
  for (const side of [-1, 1])
    for (let i = 0; i < 95; i++) {
      const length = 0.052 + 0.018 * Math.sin(i * 1.71);
      box(
        root,
        -0.19 + side * (3.21 + length * 0.46),
        0.005,
        -1.035 + i * 0.0367,
        length,
        0.006,
        0.011,
        m.piping
      );
    }
  for (const z of [-3.64, 4.33]) box(root, 0, 0.006, z, 11.85, 0.01, 0.042, m.walnut);
  for (const x of [-5.78, 5.78]) box(root, x, 0.006, 0.34, 0.04, 0.01, 8.02, m.walnut);
  const shade = paintedTexture(96, 96, (c) => {
    const v = c.createRadialGradient(48, 48, 2, 48, 48, 46);
    v.addColorStop(0, '#30241de3');
    v.addColorStop(0.5, '#30241d75');
    v.addColorStop(1, '#30241d00');
    c.fillStyle = v;
    c.fillRect(0, 0, 96, 96);
  });
  const contactMat = new THREE.MeshBasicMaterial({
    map: shade,
    transparent: true,
    depthWrite: false,
    opacity: 0.56,
  });
  for (const [x, z, w, d] of [
    [0, -4.07, 3.9, 1.15],
    [-2.47, -4.11, 1.4, 0.82],
    [2.06, -4.11, 1.07, 0.9],
    [3.28, -4.05, 1.04, 0.9],
    [4.97, 0.88, 1.85, 3.6],
    [-5.66, -1.61, 1.4, 5.0],
  ]) {
    floorPlane(root, w, d, contactMat, x, 0.014, z);
  }
  const light = floorPlane(root, 8.3, 5.9, floorLight(), -0.36, 0.02, -1.42);
  light.renderOrder = 1;
  batchRoom(root);
  const chime = moonChime(scene, m);
  const shadow = floorPlane(scene, 1.04, 0.66, contactMat.clone(), 0, 0.025, 0);
  shadow.renderOrder = 2;
  return { shadow, chime };
}
