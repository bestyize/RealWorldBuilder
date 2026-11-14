import * as THREE from 'three';

export const STUDIO_WINDOW_POSITION = [-3.85, 4.25, 2.6];

export function createStudioEnvironment(renderer) {
  const width = 256;
  const height = 128;
  const pixels = new Uint16Array(width * height * 4);
  const softboxes = [
    { direction: STUDIO_WINDOW_POSITION, power: [3.7, 3.32, 2.89], width: 12, height: 3.7 },
    { direction: [.68, .31, .73], power: [.72, .73, .78], width: 5, height: 3 },
    { direction: [.41, .70, -.70], power: [1.8, 1.66, 1.46], width: 8, height: 5 },
  ].map(box => {
    const facing = new THREE.Vector3(...box.direction).normalize();
    const across = new THREE.Vector3(0, 1, 0).cross(facing).normalize();
    return { ...box, facing, across, rise: facing.clone().cross(across) };
  });
  const ray = new THREE.Vector3();
  for (let y = 0; y < height; y += 1) {
    const latitude = ((y + .5) / height - .5) * Math.PI;
    for (let x = 0; x < width; x += 1) {
      const longitude = ((x + .5) / width - .5) * Math.PI * 2;
      ray.set(Math.cos(longitude) * Math.cos(latitude), Math.sin(latitude), Math.sin(longitude) * Math.cos(latitude));
      const room = .10 + .18 * THREE.MathUtils.smoothstep(ray.y, -.72, .85);
      const light = [room * 1.05, room, room * .94];
      for (const box of softboxes) {
        const facing = ray.dot(box.facing);
        if (facing <= 0) continue;
        const u = ray.dot(box.across) / facing;
        const v = ray.dot(box.rise) / facing;
        const soft = Math.exp(-u * u * box.width - v * v * box.height);
        for (let i = 0; i < 3; i += 1) light[i] += soft * box.power[i];
      }
      const offset = (y * width + x) * 4;
      for (let i = 0; i < 3; i += 1) pixels[offset + i] = THREE.DataUtils.toHalfFloat(light[i]);
      pixels[offset + 3] = 0x3c00;
    }
  }
  const panorama = new THREE.DataTexture(pixels, width, height, THREE.RGBAFormat, THREE.HalfFloatType);
  panorama.mapping = THREE.EquirectangularReflectionMapping;
  panorama.colorSpace = THREE.LinearSRGBColorSpace;
  panorama.minFilter = THREE.LinearFilter;
  panorama.magFilter = THREE.LinearFilter;
  panorama.needsUpdate = true;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const result = pmrem.fromEquirectangular(panorama);
  pmrem.dispose();
  panorama.dispose();
  return result;
}

export function createLinenFloor(anisotropy) {
  const size = 384;
  const pixels = new Uint8Array(size * size * 4);
  const grain = new Uint8Array(size * size * 4);
  const height = new Float32Array(size * size);
  const cycle = Math.PI * 2;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const u = x / size, v = y / size;
      const p = cycle * (40 * u + .08 * Math.sin(cycle * (4 * v + 2 * u)));
      const q = cycle * (42 * v + .11 * Math.sin(cycle * (3 * u - 2 * v)));
      const warp = (.5 + .5 * Math.cos(p)) ** 1.73;
      const weft = (.5 + .5 * Math.cos(q)) ** 1.67;
      const crossing = Math.cos(p / 2) * Math.cos(q / 2);
      const weave = Math.max(warp * (.65 + .29 * crossing), weft * (.66 - .29 * crossing));
      const tint = (weave - .43) * 20 + 1.6 * Math.sin(cycle * (13 * u + 9 * v));
      const i = y * size + x;
      height[i] = weave;
      pixels.set([219 + tint, 200 + tint, 176 + tint, 255], i * 4);
    }
  }
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = (height[y * size + (x + 1) % size] - height[y * size + (x + size - 1) % size]) * -.62;
      const dy = (height[((y + 1) % size) * size + x] - height[((y + size - 1) % size) * size + x]) * -.62;
      const scale = 127.5 / Math.hypot(dx, dy, 1);
      grain.set([127.5 + dx * scale, 127.5 + dy * scale, 127.5 + scale, 255], (y * size + x) * 4);
    }
  }

  function textileTexture(data, colorSpace) {
    const map = new THREE.DataTexture(data, size, size);
    map.colorSpace = colorSpace;
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.minFilter = THREE.LinearMipmapLinearFilter;
    map.magFilter = THREE.LinearFilter;
    map.generateMipmaps = true;
    map.anisotropy = anisotropy;
    map.repeat.set(14, 14);
    map.needsUpdate = true;
    return map;
  }

  const surface = new THREE.PlaneGeometry(10, 10, 120, 120);
  surface.rotateX(-Math.PI / 2);
  const positions = surface.attributes.position;
  for (let i = 0; i < positions.count; i += 1) {
    const x = positions.getX(i), z = positions.getZ(i);
    const edge = THREE.MathUtils.smoothstep(Math.max(Math.abs(x), Math.abs(z)), 3.15, 4.95);
    const outside = THREE.MathUtils.smoothstep(Math.hypot(x / .95, (z - .31) / 1.32), .86, 1.70);
    const fold = .031 * Math.sin(z * 4 - x * 1.20 + .82 * Math.sin(x * 1.91));
    const ridge = (z - 1.86 + .32 * x + .41 * Math.sin(x));
    const wrinkle = .022 * Math.sin(z * 9.9 - x * 2.7) * Math.sin(x * 2.9 + z * 2.0);
    const linen = fold + wrinkle + .105 * Math.exp(-(ridge * ridge) / .15);
    positions.setY(i, -.010 + linen * outside * (1 - edge));
  }
  surface.computeVertexNormals();
  const material = new THREE.MeshPhysicalMaterial({
    map: textileTexture(pixels, THREE.SRGBColorSpace),
    normalMap: textileTexture(grain, THREE.NoColorSpace),
    normalScale: new THREE.Vector2(.51, .51),
    roughness: .94,
    specularIntensity: .20,
    transparent: true,
    depthWrite: false,
  });
  // Feather the tabletop into the out-of-focus studio at the edge of the frame.
  material.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 tabletop;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\ntabletop = position.xz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec2 tabletop;')
      .replace('#include <alphatest_fragment>', `
        #include <alphatest_fragment>
        diffuseColor.a *= 1.0 - smoothstep(3.1, 4.95, max(abs(tabletop.x), abs(tabletop.y)));
      `);
  };
  const linen = new THREE.Mesh(surface, material);
  linen.renderOrder = -2;
  return linen;
}

function depthMaterial() {
  const material = new THREE.MeshDepthMaterial();
  material.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float heightAboveFloor;')
      .replace('#include <project_vertex>', `
        heightAboveFloor = (modelMatrix * vec4(transformed, 1.0)).y;
        #include <project_vertex>
      `);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float heightAboveFloor;')
      .replace('gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );', `
        float strength = exp(-heightAboveFloor * 3.25);
        gl_FragColor = vec4(vec3(strength), 1.0);
      `);
  };
  return material;
}

// Bake the static model's contact shadows once. The blur stays soft as the camera orbits.
export function createContactShadow(renderer, model, centerZ) {
  const extent = 6.3;
  const resolution = 512;
  const depth = new THREE.WebGLRenderTarget(resolution, resolution, { minFilter: THREE.LinearFilter });
  const passA = new THREE.WebGLRenderTarget(resolution, resolution, { minFilter: THREE.LinearFilter, depthBuffer: false });
  const tight = passA.clone();
  const finish = passA.clone();
  const camera = new THREE.OrthographicCamera(-extent / 2, extent / 2, extent / 2, -extent / 2, .01, 4);
  camera.position.set(0, -.02, centerZ);
  camera.up.set(0, 0, -1);
  camera.lookAt(0, 2, centerZ);
  const mask = depthMaterial();
  const capture = new THREE.Scene();
  capture.add(model);
  capture.overrideMaterial = mask;
  renderer.setRenderTarget(depth);
  renderer.setClearColor(0, 0);
  renderer.render(capture, camera);
  capture.remove(model);

  const blur = new THREE.ShaderMaterial({
    uniforms: {
      source: { value: depth.texture }, shift: { value: new THREE.Vector2() },
      tight: { value: null },
    },
    depthTest: false,
    depthWrite: false,
    vertexShader: `
      varying vec2 sampleUV;
      void main() {
        sampleUV = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D source;
      uniform sampler2D tight;
      uniform vec2 shift;
      varying vec2 sampleUV;
      void main() {
        float value = texture2D(source, sampleUV).r * .227027;
        value += (texture2D(source, sampleUV + shift * 1.384615).r
                + texture2D(source, sampleUV - shift * 1.384615).r) * .316216;
        value += (texture2D(source, sampleUV + shift * 3.230769).r
                + texture2D(source, sampleUV - shift * 3.230769).r) * .070270;
        #ifdef COMBINE
          float detail = texture2D(tight, sampleUV).r;
          value = min(1.0, detail * .73 + value * .53);
        #endif
        gl_FragColor = vec4(value, value, value, 1.0);
      }
    `,
  });
  const geometry = new THREE.PlaneGeometry(2, 2);
  const processing = new THREE.Scene();
  processing.add(new THREE.Mesh(geometry, blur));
  const screen = new THREE.Camera();
  function blurAxis(input, target, dx, dy) {
    blur.uniforms.source.value = input.texture;
    blur.uniforms.shift.value.set(dx / resolution, dy / resolution);
    renderer.setRenderTarget(target);
    renderer.render(processing, screen);
  }
  blurAxis(depth, passA, 1.3, 0);
  blurAxis(passA, tight, 0, 1.3);
  blurAxis(depth, passA, 5.9, 0);
  blur.defines.COMBINE = '';
  blur.uniforms.tight.value = tight.texture;
  blur.needsUpdate = true;
  blurAxis(passA, finish, 0, 5.9);

  renderer.setRenderTarget(null);
  depth.dispose();
  passA.dispose();
  tight.dispose();
  blur.dispose();
  mask.dispose();
  geometry.dispose();

  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(extent, extent),
    new THREE.MeshBasicMaterial({ color: 0x624330, alphaMap: finish.texture, opacity: .62,
      transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.scale.x = -1;
  shadow.position.set(0, -.003, centerZ);
  shadow.renderOrder = -1;
  return shadow;
}
