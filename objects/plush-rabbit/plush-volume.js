import * as THREE from 'three';
import { makeNapDetail } from './nap-detail.js';
import { addNapFibers } from './nap-fibers.js';

const PLUSH_MATERIAL = '01 · Combed oatmeal short plush';
const LAYERS = 6;
const DIRECT_LIGHTS = THREE.ShaderChunk.lights_fragment_begin.replace(
  /(getDirectionalLightInfo\( directionalLight, directLight \);[\s\S]*?#endif)/,
  `$1
    if (UNROLLED_LOOP_INDEX == 0) {
      // Only the broad window light runs through this fiber lobe. The light
      // color here already includes visibility from the model's shadows.
      vec3 silkLight = directLight.direction;
      float alignment = dot(normalize(silkLight + silkView), silkAxis);
      float longitudinal = exp(-6.6 * alignment * alignment);
      float wrap = smoothstep(-.19, .68, dot(nonPerturbedNormal, silkLight));
      float rim = 1.0 - .41 * saturate(dot(nonPerturbedNormal, silkView));
      float occlusion = smoothstep(.45, .98, max3(vColor.rgb));
      reflectedLight.directSpecular += diffuseColor.rgb * directLight.color
        * (.255 * groomGlint * longitudinal * wrap * rim * silkStrength * occlusion);
    }
`,
);

// Sample the same fiber cross-section through each layer. Elongated groups stay
// coherent through the volume instead of reading as separate flecks on each shell.
function makeFiberAtlas(anisotropy) {
  const size = 512, wrap = size - 1;
  const texels = new Uint8Array(size * size * LAYERS);
  let seed = 189717;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let group = 0; group < 30500; group += 1) {
    const u = random() * size, v = random() * size;
    const lift = .27 + .87 * random() ** .68;
    const spread = .5 + 1.18 * random();
    const tint = .72 + .28 * random();
    for (let strand = 0; strand < 3; strand += 1) {
      const x = u + (random() - .5) * spread;
      const y = v + (random() - .5) * 4.3;
      const tip = lift * (.78 + .22 * random());
      const width = .47 + .36 * random();
      for (let layer = 0; layer < LAYERS; layer += 1) {
        const height = (layer + .82) / LAYERS;
        if (height > tip) break;
        const t = height / tip;
        const rx = .56 + width * (1 - .46 * t);
        const ry = rx * (2.4 + 1.0 * (1 - t));
        const cx = x + .68 * t * t, cy = y + 3.8 * t;
        for (let iy = Math.floor(cy - ry); iy <= Math.ceil(cy + ry); iy += 1) {
          const row = (layer * size + (iy & wrap)) * size;
          const dy = (iy - cy) / ry;
          for (let ix = Math.floor(cx - rx); ix <= Math.ceil(cx + rx); ix += 1) {
            const dx = (ix - cx) / rx;
            const coverage = 1 - THREE.MathUtils.smoothstep(dx * dx + dy * dy, .08, 1.0);
            const i = row + (ix & wrap);
            texels[i] = Math.max(texels[i], Math.round(coverage * tint * 255));
          }
        }
      }
    }
  }
  const atlas = new THREE.DataArrayTexture(texels, size, size, LAYERS);
  atlas.format = THREE.RedFormat;
  atlas.wrapS = atlas.wrapT = THREE.RepeatWrapping;
  atlas.minFilter = THREE.LinearMipmapLinearFilter;
  atlas.magFilter = THREE.LinearFilter;
  atlas.generateMipmaps = true;
  atlas.anisotropy = anisotropy;
  atlas.needsUpdate = true;
  return atlas;
}

function configureSilk(material, detail, atlas) {
  const shell = Boolean(atlas);
  material.anisotropy = .64;
  material.roughness = .94;
  material.specularIntensity = .30;
  material.normalScale.multiplyScalar(shell ? .62 : .76);
  material.color.multiply(new THREE.Color(1, .955, .903));
  material.sheen = 1;
  material.sheenRoughness = .79;
  material.sheenColor.setRGB(.105, .081, .063);
  material.transparent = shell;
  material.depthWrite = !shell;
  material.side = THREE.FrontSide;
  material.customProgramCacheKey = () => shell ? 'nap-detail-pile' : 'nap-detail-ground';

  material.onBeforeCompile = shader => {
    shader.uniforms.napDetail = { value: detail };
    if (shell) shader.uniforms.fiberAtlas = { value: atlas };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `
        #include <common>
        attribute vec3 _nap;
        varying vec3 silkNap;
        varying vec3 pileSurface;
        ${shell ? `
          attribute vec2 pileProfile;
          varying float pileDensity;
          flat varying float pileLayer;
        ` : ''}
      `)
      .replace('#include <begin_vertex>', `
        #include <begin_vertex>
        silkNap = normalMatrix * _nap;
        pileSurface = position;
        ${shell ? `
          pileLayer = float(gl_InstanceID);
          float height = (pileLayer + 1.0) / ${LAYERS}.0;
          pileDensity = pileProfile.y;
          vec3 along = _nap - normal * dot(_nap, normal);
          along *= inversesqrt(max(dot(along, along), .039));
          transformed += pileProfile.x * (normal * height + along * 2.05 * height * height);
        ` : ''}
      `);

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `
        #include <common>
        uniform sampler2D napDetail;
        varying vec3 silkNap;
        varying vec3 pileSurface;
        ${shell ? `
          uniform highp sampler2DArray fiberAtlas;
          varying float pileDensity;
          flat varying float pileLayer;
        ` : ''}
      `)
      .replace('#include <normal_fragment_maps>', `
        #include <normal_fragment_maps>

        // Project the fine pile at a constant size on the fabric. The three
        // charts blend only around their edges, to avoid UV pinching on caps.
        vec3 localNormal = transformNormalByInverseViewMatrix(nonPerturbedNormal, viewMatrix);
        vec3 weights = pow(abs(localNormal), vec3(6.0));
        weights /= max(dot(weights, vec3(1.0)), .0001);
        // Every chart has its long axis down the fabric. The broad fan is
        // applied in model space, including on both sides of the same seam.
        vec3 q = pileSurface;
        float front = smoothstep(-.17, .56, q.z);
        float face = smoothstep(1.72, 2.08, q.y) * front;
        float sweep = .59 * tanh(6.0 * q.x) * (1.0 - .16 * cos(8.0 * q.y));
        q.x += face * sweep * (q.y - 2.14);
        float paw = (1.0 - smoothstep(.55, .92, q.y)) * smoothstep(.66, .97, q.z);
        float side = tanh(12.0 * q.x);
        q.x += paw * .39 * tanh(8.0 * (q.x - .46 * side)) * (q.y - .43);
        q.x += .0070 * sin(51.0 * q.y + 33.0 * q.z + 22.0 * q.x)
             + .0101 * sin(24.0 * q.y - 17.0 * q.x) * sin(19.0 * q.z + 24.0 * q.x);
        vec2 uvFront = vec2(q.x, -q.y) * .69;
        vec2 uvSide = vec2(q.z + .111, -q.y + .071) * .69;
        vec2 uvTop = vec2(q.x - .32, q.z + .17) * .69;
        vec4 frontPile = texture2D(napDetail, uvFront);
        vec4 sidePile = texture2D(napDetail, uvSide);
        vec4 topPile = texture2D(napDetail, uvTop);
        vec4 detail = frontPile * weights.z + sidePile * weights.x + topPile * weights.y;
        float groomTone = detail.b - .44;
        float unpack = clamp(.93 + .12 * sin(q.x * 31.0 + q.y * 13.0) * sin(q.z * 27.0 - q.y * 15.0), .72, 1.0);
        float groomGlint = (.13 + 3.28 * detail.a) * unpack;
        vec3 frontSlope = vec3(frontPile.r - .5, .5 - frontPile.g, 0.0);
        vec3 sideSlope = vec3(0.0, .5 - sidePile.g, sidePile.r - .5);
        vec3 topSlope = vec3(topPile.r - .5, 0.0, topPile.g - .5);
        vec3 ripple = mat3(viewMatrix) * (frontSlope * weights.z + sideSlope * weights.x + topSlope * weights.y);
        ripple -= nonPerturbedNormal * dot(ripple, nonPerturbedNormal);
        normal = normalize(normal + ripple * ${shell ? '.51' : '.76'});
        diffuseColor.rgb *= .996 + groomTone * .61;
        ${shell ? `
          float height = (pileLayer + 1.0) / ${LAYERS}.0;
          float fiber = texture(fiberAtlas, vec3(uvFront, pileLayer)).r * weights.z
                      + texture(fiberAtlas, vec3(uvSide, pileLayer)).r * weights.x
                      + texture(fiberAtlas, vec3(uvTop, pileLayer)).r * weights.y;
          float coverage = smoothstep(.13, .70, fiber) * pileDensity;
          if (coverage < .051) discard;
          diffuseColor.a = coverage * (.52 - .19 * height);
          diffuseColor.rgb *= .994 + .034 * height + .028 * (fiber - .48);
          groomGlint *= .83 + .56 * height;
        ` : ''}
      `)
      .replace('#include <lights_physical_fragment>', `
        #include <lights_physical_fragment>
        material.roughness = clamp(material.roughness + .080 - detail.a * .43, .48, .935);
        vec3 silkAlong = silkNap - nonPerturbedNormal * dot(silkNap, nonPerturbedNormal);
        float silkStrength = smoothstep(.02, .28, dot(silkAlong, silkAlong));
        vec3 silkTangent = normalize(silkAlong + tbn[0] * .0001);
        vec3 silkAcross = normalize(cross(nonPerturbedNormal, silkTangent));
        material.anisotropyT = silkTangent;
        material.anisotropyB = silkAcross;
        material.anisotropy *= silkStrength * clamp(groomGlint, .25, .89);
        material.alphaT = mix(pow2(material.roughness), 1.0, pow2(material.anisotropy));
        // Tilt the reflective fiber axis toward the lifted ends of the pile.
        vec3 silkView = normalize(vViewPosition);
        vec3 silkAxis = normalize(silkTangent * .94 + nonPerturbedNormal * .33 + ripple * .44);
        float napShift = dot(silkAxis, silkView);
        material.sheenColor *= mix(.56, 1.23, smoothstep(-.50, .58, napShift) * silkStrength) * (.54 + groomGlint);
      `)
      .replace('#include <lights_fragment_begin>', DIRECT_LIGHTS);
  };
}

function makeShellGeometry(base, name) {
  const geometry = new THREE.InstancedBufferGeometry();
  for (const key of ['position', 'normal', 'tangent', 'uv', 'color', '_nap']) {
    geometry.setAttribute(key, base.getAttribute(key));
  }
  geometry.setIndex(base.index);
  geometry.instanceCount = LAYERS;

  const positions = base.getAttribute('position');
  const profile = new Float32Array(positions.count * 2);
  const face = name.startsWith('Head');
  const ear = /ear/i.test(name);
  const foot = name.includes('foot');
  const loft = foot ? .016 : ear ? .016 : face ? .014 : .016;
  for (let i = 0; i < positions.count; i += 1) {
    const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
    const sweep = Math.sin(x * 27 + z * 17) * Math.cos(y * 24 - x * 9);
    const group = Math.cos(x * 62 + y * 32) * Math.sin(z * 36 - x * 23);
    let lift = 1;
    if (face && z > .38) {
      const eye = Math.hypot((Math.abs(x) - .326) / .033, (y - 2.278) / .050);
      const nose = Math.hypot(x / .068, (y - 2.135) / .063);
      const mouth = Math.hypot(x / .068, (y - 2.053) / .040);
      lift = THREE.MathUtils.smoothstep(Math.min(eye, nose, mouth), .78, 1.59);
    }
    if (foot) lift *= THREE.MathUtils.smoothstep(y, .027, .11);
    profile[i * 2] = loft * (1 + .16 * sweep + .075 * group) * lift;
    profile[i * 2 + 1] = (.87 + .10 * sweep + .04 * group) * lift;
  }
  geometry.setAttribute('pileProfile', new THREE.BufferAttribute(profile, 2));
  geometry.computeBoundingSphere();
  geometry.boundingSphere.radius += .05;
  return geometry;
}

export function addPlushVolume(model, anisotropy, windowPosition) {
  const surfaces = [];
  model.traverse(mesh => {
    if (mesh.isMesh && mesh.material.name === PLUSH_MATERIAL && mesh.geometry.hasAttribute('_nap')) {
      surfaces.push(mesh);
    }
  });
  if (!surfaces.length) return () => {};

  const detail = makeNapDetail(anisotropy);
  const atlas = makeFiberAtlas(anisotropy);
  const shellMaterials = new Map();
  for (const surface of surfaces) {
    if (!shellMaterials.has(surface.material)) {
      const canopy = surface.material.clone();
      canopy.name = 'Combed plush · silk pile';
      configureSilk(canopy, detail, atlas);
      configureSilk(surface.material, detail);
      shellMaterials.set(surface.material, canopy);
    }
    // GLTFLoader uses unnamed suffix meshes for extra primitives on an ear/toe.
    const panel = /^(Left|Right|Head|Body|Tail)[_ ·]/.test(surface.name) ? surface.name : surface.parent.name;
    const fibers = new THREE.Mesh(makeShellGeometry(surface.geometry, panel), shellMaterials.get(surface.material));
    fibers.name = 'Combed plush fibers';
    fibers.renderOrder = 1;
    fibers.receiveShadow = true;
    surface.add(fibers);
  }
  return addNapFibers(surfaces, windowPosition);
}
