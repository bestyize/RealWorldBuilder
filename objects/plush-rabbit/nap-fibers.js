import * as THREE from 'three';

// Small groups of optical fibers, rooted to the GLB shell. They are separate
// from the pile texture so a close orbit reveals parallax and light on their tips.
function scatterLocks(surface, name, seed) {
  const { attributes, index } = surface.geometry;
  const { position, normal, color, _nap: nap } = attributes;
  const read = (attribute, i, out) => out.set(attribute.getX(i), attribute.getY(i), attribute.getZ(i));
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const count = index?.count ?? position.count;
  const areas = new Float32Array(count / 3);
  const a = new THREE.Vector3(), b = a.clone(), c = a.clone(), edgeA = a.clone(), edgeB = a.clone();
  const indexAt = i => index ? index.getX(i) : i;
  let total = 0;
  for (let k = 0; k < count; k += 3) {
    read(position, indexAt(k), a);
    read(position, indexAt(k + 1), b);
    read(position, indexAt(k + 2), c);
    total += edgeA.subVectors(b, a).cross(edgeB.subVectors(c, a)).length() * .5;
    areas[k / 3] = total;
  }

  const budget = Math.ceil(total * (name.startsWith('Head') ? 4200 : 3150)) * 3;
  const roots = new Float32Array(budget * 3), normals = new Float32Array(budget * 3);
  const tangents = new Float32Array(budget * 3);
  const traits = new Float32Array(budget * 4);
  const p = a.clone(), n = a.clone(), t = a.clone(), cross = a.clone(), root = a.clone(), shade = a.clone();
  let cursor = 0;
  for (let lock = 0; lock < budget / 3; lock += 1) {
    const draw = random() * total;
    let low = 0, high = areas.length - 1;
    while (low < high) {
      const mid = (low + high) >>> 1;
      if (areas[mid] < draw) low = mid + 1;
      else high = mid;
    }
    const ia = indexAt(low * 3), ib = indexAt(low * 3 + 1), ic = indexAt(low * 3 + 2);
    let u = random(), v = random();
    if (u + v > 1) { u = 1 - u; v = 1 - v; }
    const w = 1 - u - v;
    const sample = (attr, out) => read(attr, ia, out).multiplyScalar(w)
      .addScaledVector(read(attr, ib, b), u).addScaledVector(read(attr, ic, c), v);
    sample(position, p);
    sample(normal, n).normalize();
    sample(nap, t);
    t.addScaledVector(n, -t.dot(n));
    if (t.lengthSq() < .012) continue;
    t.normalize();
    cross.crossVectors(n, t).normalize();
    const { x, y, z } = p;
    const bend = Math.sin(x * 37 + z * 21 - y * 26) * Math.cos(x * 18 + y * 19) * .21;
    const press = .5 + .34 * Math.sin(24 * x + 19 * z) * Math.cos(y * 29 - z * 15)
      + .16 * Math.sin(63 * y - 14 * x) * Math.sin(x * 38 + 27 * z);
    const open = THREE.MathUtils.smoothstep(press, .22, .83);
    let lift = .0022 + (.0038 + .0058 * random() ** 2) * open;
    if (name.startsWith('Head') && z > .41) {
      const eye = Math.hypot((Math.abs(x) - .326) / .036, (y - 2.278) / .052);
      const nose = Math.hypot(x / .075, (y - 2.135) / .068);
      const mouth = Math.hypot(x / .075, (y - 2.053) / .045);
      lift *= THREE.MathUtils.smoothstep(Math.min(eye, nose, mouth), .96, 1.53);
    }
    if (name.includes('foot')) lift *= THREE.MathUtils.smoothstep(y, .043, .15);
    if (lift < .0019) continue;
    sample(color, shade);
    const length = (.010 + .028 * random() ** .98) * (.74 + .49 * open);
    const lustre = (.21 + .79 * random() ** 2.1) * (.39 + .61 * open);
    for (let hair = 0; hair < 3; hair += 1) {
      const spread = (hair - 1 + .35 * (random() - .5)) * .0016;
      root.copy(p).addScaledVector(cross, spread).addScaledVector(t, (random() - .5) * .006);
      root.toArray(roots, cursor * 3);
      n.toArray(normals, cursor * 3);
      a.copy(t).addScaledVector(cross, bend + .11 * (random() - .5)).normalize().toArray(tangents, cursor * 3);
      traits[cursor * 4] = length * (.70 + .56 * random());
      traits[cursor * 4 + 1] = lift * (.54 + .77 * random());
      traits[cursor * 4 + 2] = .00054 + .00064 * random() ** .84;
      traits[cursor * 4 + 3] = lustre * (.83 + .30 * random()) * (.57 + .43 * shade.x);
      cursor += 1;
    }
  }

  const geometry = new THREE.InstancedBufferGeometry();
  geometry.instanceCount = cursor;
  geometry.setIndex([0, 1, 2, 2, 1, 3, 2, 3, 4, 4, 3, 5]);
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([
    -1, 0, 0, 1, 0, 0, -1, .47, 0, 1, .47, 0, -1, 1, 0, 1, 1, 0,
  ], 3));
  geometry.setAttribute('rootPoint', new THREE.InstancedBufferAttribute(roots.subarray(0, cursor * 3), 3));
  geometry.setAttribute('rootNormal', new THREE.InstancedBufferAttribute(normals.subarray(0, cursor * 3), 3));
  geometry.setAttribute('grainDirection', new THREE.InstancedBufferAttribute(tangents.subarray(0, cursor * 3), 3));
  geometry.setAttribute('strand', new THREE.InstancedBufferAttribute(traits.subarray(0, cursor * 4), 4));
  surface.geometry.computeBoundingSphere();
  geometry.boundingSphere = surface.geometry.boundingSphere.clone();
  geometry.boundingSphere.radius += .06;
  return geometry;
}

function fiberMaterial(windowPosition) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { studioWindow: { value: new THREE.Vector3(...windowPosition).normalize() } },
    vertexShader: `
      attribute vec3 rootPoint;
      attribute vec3 rootNormal;
      attribute vec3 grainDirection;
      attribute vec4 strand;
      varying vec3 fiberAxis;
      varying vec3 fiberNormal;
      varying vec3 fiberView;
      varying vec2 fiberUV;
      varying float fiberLustre;
      varying float fiberDetail;

      void main() {
        float t = position.y;
        vec3 axis = grainDirection;
        vec3 across = cross(rootNormal, axis);
        float curve = 4.0 * t * (1.0 - .75 * t);
        float drop = 1.5 * strand.x * strand.x * t * t;
        vec3 p = rootPoint + axis * (strand.x * t)
          + rootNormal * (strand.y * curve - drop - .0006);
        vec4 rootView = modelViewMatrix * vec4(p, 1.0);
        fiberView = normalize(-rootView.xyz);
        fiberNormal = normalize(normalMatrix * rootNormal);
        fiberAxis = normalize(mat3(modelViewMatrix) * (axis * strand.x + rootNormal * strand.y * (3.7 - 5.6 * t)));
        fiberUV = position.xy;
        fiberLustre = strand.w;
        fiberDetail = 1.0 - smoothstep(4.75, 7.0, length(rootView.xyz));
        float taper = .2 + .8 * (1.0 - pow(t, 2.5));
        vec3 widthAxis = normalize(mat3(modelViewMatrix) * across + .27 * cross(fiberAxis, fiberView));
        rootView.xyz += widthAxis * (position.x * strand.z * taper);
        gl_Position = projectionMatrix * rootView;
      }
    `,
    fragmentShader: `
      uniform vec3 studioWindow;
      varying vec3 fiberAxis;
      varying vec3 fiberNormal;
      varying vec3 fiberView;
      varying vec2 fiberUV;
      varying float fiberLustre;
      varying float fiberDetail;

      void main() {
        vec3 normal = normalize(fiberNormal);
        vec3 view = normalize(fiberView);
        float surface = dot(normal, view);
        float edge = 1.0 - smoothstep(.32, 1.0, abs(fiberUV.x));
        float tip = smoothstep(.02, .29, fiberUV.y) * (1.0 - smoothstep(.83, 1.0, fiberUV.y));
        float mask = edge * tip * smoothstep(.02, .40, surface) * fiberDetail;
        if (mask < .035) discard;
        vec3 light = mat3(viewMatrix) * studioWindow;
        vec3 halfLight = normalize(light + view);
        float alignment = dot(normalize(fiberAxis), halfLight);
        float sheen = exp(-13.5 * alignment * alignment) * smoothstep(-.16, .60, dot(normal, light));
        float glint = sheen * fiberLustre;
        vec3 cream = vec3(.73, .553, .410);
        vec3 shaded = cream * (.58 + .25 * smoothstep(-.40, .78, dot(normal, light)) + glint * .63);
        gl_FragColor = vec4(shaded, mask * (.51 + glint * .92));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
}

export function addNapFibers(surfaces, windowPosition) {
  const material = fiberMaterial(windowPosition);
  const locks = [];
  for (const [i, surface] of surfaces.entries()) {
    const name = /^(Left|Right|Head|Body|Tail)[_ ·]/.test(surface.name) ? surface.name : surface.parent.name;
    const mesh = new THREE.Mesh(scatterLocks(surface, name, 3571 + i * 117), material);
    mesh.name = 'Fine combed nap';
    mesh.renderOrder = 2;
    mesh.visible = false;
    surface.add(mesh);
    locks.push(mesh);
  }
  const p = new THREE.Vector3();
  return camera => {
    for (const mesh of locks) {
      p.copy(mesh.geometry.boundingSphere.center).applyMatrix4(mesh.matrixWorld);
      mesh.visible = p.distanceTo(camera.position) - mesh.geometry.boundingSphere.radius * 1.04 < 7;
    }
  };
}
