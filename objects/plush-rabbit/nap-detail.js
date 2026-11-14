import * as THREE from 'three';

// A tile of overlapping, combed filaments. R/G carry the local slope, B the
// root occlusion, and A how much of the coherent upper pile catches the light.
export function makeNapDetail(anisotropy) {
  const size = 1024, mask = size - 1, area = size * size;
  const relief = new Float32Array(area);
  const highlights = new Float32Array(area);
  const ground = new Float32Array(area);
  const compression = new Float32Array(area);
  const pixels = new Uint8Array(area * 4);
  let seed = 0xa86deb17;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  function field(cols, rows) {
    const knots = Float32Array.from({ length: cols * rows }, random);
    return (x, y) => {
      const s = (x & mask) * cols / size, t = (y & mask) * rows / size;
      const a = Math.floor(s), b = Math.floor(t), right = (a + 1) % cols, top = (b + 1) % rows;
      const u = s - a, v = t - b;
      const h = u * u * (3 - 2 * u), k = v * v * (3 - 2 * v);
      const lo = knots[b * cols + a], hi = knots[top * cols + a];
      return THREE.MathUtils.lerp(
        THREE.MathUtils.lerp(lo, knots[b * cols + right], h),
        THREE.MathUtils.lerp(hi, knots[top * cols + right], h), k,
      );
    };
  }

  const brushing = field(17, 12);
  const lock = field(52, 32);
  const pressure = field(13, 16);
  const grain = field(90, 54);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const i = y * size + x;
      const b = brushing(x, y), k = lock(x, y), t = pressure(x, y);
      ground[i] = .57 + (b - .5) * .21 + (k - .5) * .19 + (grain(x, y) - .5) * .085;
      compression[i] = THREE.MathUtils.smoothstep(t * .65 + b * .35, .28, .77);
    }
  }

  // Rasterize tapered, slightly diverging fibers a scanline at a time. A lock
  // shares a root direction, but each filament has its own reach, tilt and tip.
  for (let clump = 0; clump < 35100; clump += 1) {
    const x = size * random(), y = size * random();
    const at = (y & mask) * size + (x & mask);
    const fold = compression[at];
    const slant = .61 * (brushing(x, y) - .5) + .69 * (lock(x, y) - .5);
    const bow = (random() - .5) * 5.5;
    const reach = (4.8 + 12.9 * random() ** 1.55) * (1.09 - .30 * fold);
    const warp = (random() - .5) * 1.3;
    const count = 2 + Math.floor(random() * 4);
    const reflect = .12 + .88 * random() ** 2.4;
    const tuft = .35 + .55 * random() ** .73;
    for (let hair = 0; hair < count; hair += 1) {
      const rootX = x + (hair - (count - 1) * .5) * (.87 + .23 * random());
      const rootY = y + (random() - .5) * 4.5;
      const length = reach * (.59 + .53 * random());
      const lean = slant + .26 * (random() - .5);
      const width = .62 + .47 * random() ** .83;
      const crest = tuft * (.68 + .41 * random());
      const lit = reflect * (.59 + .37 * random()) * (1 - .62 * fold);
      for (let iy = Math.floor(rootY); iy <= Math.ceil(rootY + length); iy += 1) {
        const t = (iy + .5 - rootY) / length;
        if (t <= 0 || t >= 1) continue;
        const center = rootX + length * lean * t + bow * t * t + warp * Math.sin(t * Math.PI);
        const taper = 1 - .83 * t * t * t;
        const span = width * (.72 + .41 * taper);
        const rise = THREE.MathUtils.smoothstep(t, 0, .19) * (1 - THREE.MathUtils.smoothstep(t, .68, 1));
        const row = (iy & mask) * size;
        for (let ix = Math.floor(center - span); ix <= Math.ceil(center + span); ix += 1) {
          const distance = (ix + .5 - center) / span;
          const section = Math.max(0, 1 - distance * distance);
          const profile = section * section;
          const height = profile * rise * crest;
          const i = row + (ix & mask);
          if (height > relief[i]) {
            relief[i] = height;
            // A light-facing shoulder runs along the fiber, narrowing toward its end.
            highlights[i] = lit * rise * profile * (.77 + .21 * distance);
          }
        }
      }
    }
  }

  for (let y = 0; y < size; y += 1) {
    const row = y * size, prev = ((y - 1) & mask) * size, next = ((y + 1) & mask) * size;
    for (let x = 0; x < size; x += 1) {
      const i = row + x, at = i * 4;
      const dx = relief[row + ((x - 1) & mask)] - relief[row + ((x + 1) & mask)];
      const dy = relief[prev + x] - relief[next + x];
      pixels[at] = Math.round(127.5 + 125 * dx);
      pixels[at + 1] = Math.round(127.5 + 125 * dy);
      pixels[at + 2] = Math.round(255 * THREE.MathUtils.clamp(ground[i] - .315 + relief[i] * .89, 0, 1));
      pixels[at + 3] = Math.round(255 * THREE.MathUtils.clamp(.055 + highlights[i] * 1.35, 0, 1));
    }
  }

  const tile = new THREE.DataTexture(pixels, size, size);
  tile.wrapS = tile.wrapT = THREE.RepeatWrapping;
  tile.minFilter = THREE.LinearMipmapLinearFilter;
  tile.magFilter = THREE.LinearFilter;
  tile.generateMipmaps = true;
  tile.anisotropy = anisotropy;
  tile.needsUpdate = true;
  return tile;
}
