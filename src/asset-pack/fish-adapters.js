/** Fish-only adapters: no renderer, DOM, floor, environment or external fetch.
 * Named exports permit a generated entry to include only its selected species.
 * Pass GLB ArrayBuffer or Uint8Array. create() decodes once; modes reuse it.
 * duration is live: re-read it after setMode(), especially for the guppy.
 */
import { Group, Vector3 } from 'three';
import { loadFish } from '../../fish/load-fish.js';
import { createSwimRoute } from '../../fish/swim-route.js';
import { arowana } from '../../fish/arowana/index.js';
import { createArowanaPreviewRoute, createVermilionPreviewRoute } from '../../fish/arowana/cruise-route.js';
import { vermilionArowana } from '../../fish/vermilion-arowana/index.js';
import { blueGuppy } from '../../fish/blue-guppy/index.js';
import { createGuppySchool } from '../../fish/blue-guppy/school.js';
import { soloGuppyRoute } from '../../fish/blue-guppy/solo-route.js';
import { kohakuKoi } from '../../fish/kohaku-koi/index.js';
import { kohakuCruisePoints } from '../../fish/kohaku-koi/route.js';
import { silverAngelfish } from '../../fish/silver-angelfish/index.js';
import { cardinalTetra } from '../../fish/cardinal-tetra/index.js';
import { route as tetraRoute } from '../../fish/cardinal-tetra/route.js';
import { sterbaiCory } from '../../fish/sterbai-cory/index.js';
import { route as coryRoute } from '../../fish/sterbai-cory/route.js';

function bytes(buffer) {
  if (buffer instanceof ArrayBuffer) return buffer;
  if (ArrayBuffer.isView(buffer)) return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  throw new TypeError('Expected GLB ArrayBuffer or typed array');
}
function camera(distance, minDistance, maxDistance, y = 0) {
  return { distance, minDistance, maxDistance, targetOffset: [0, y, 0] };
}
function checkTime(time) { if (!Number.isFinite(time)) throw new RangeError('Invalid animation time'); }
function modeName(mode) {
  if (mode !== 'single' && mode !== 'school') throw new RangeError('Mode must be single or school');
  return mode;
}
const schoolingModes = [{ id: 'single', label: '单鱼' }, { id: 'school', label: '鱼群' }];
function single(species, createRoute, cameraProfile) {
  return { id: species.id, camera: cameraProfile,
    async create(buffer, options = {}) {
      const factory = await loadFish(species, bytes(buffer));
      const fish = factory(createRoute(), options.motion ?? {});
      return { ...fish, update(time) { checkTime(time); return fish.update(time); } };
    },
  };
}
export const arowanaAdapter = /* @__PURE__ */ single(arowana, createArowanaPreviewRoute, camera(9.4, 3, 25));
export const vermilionArowanaAdapter = /* @__PURE__ */ single(vermilionArowana, createVermilionPreviewRoute, camera(5.95, 2.55, 18, -.11));
export const kohakuKoiAdapter = /* @__PURE__ */ single(kohakuKoi, () => createSwimRoute(kohakuCruisePoints), camera(20.5, 8, 28, -.11));
export const silverAngelfishAdapter = /* @__PURE__ */ single(silverAngelfish, () => createSwimRoute([
 [0,0,.65],[1.1,.04,.65],[1.65,.08,.25],[1.55,.12,-.40],[.6,.10,-.65],
 [-.6,.04,-.65],[-1.55,-.03,-.40],[-1.65,-.04,.25],[-1.1,-.02,.65],
]), camera(17.5, 7.5, 30, -.405));
export const sterbaiCoryAdapter = {
 id: 'sterbai-cory', camera: camera(13.5, 7, 28, .05),
 async create(buffer, options = {}) {
   const factory = await loadFish(sterbaiCory, bytes(buffer));
   // Existing floor-aware posture remains; no visible floor is constructed.
   const fish = factory(coryRoute, options.motion ?? {});
   return { ...fish, update(time) { checkTime(time); return fish.update(time); } };
 },
};
export const cardinalTetraAdapter = {
 id: 'cardinal-tetra', camera: camera(18, 6, 30, -.05), modes: schoolingModes,
 async create(buffer, options = {}) {
   let mode = modeName(options.mode ?? 'single'), time = 0;
   const factory = await loadFish(cardinalTetra, bytes(buffer));
   const fish = factory(tetraRoute, { ...options.motion, count: 10 });
   const result = { ...fish,
     update(t) { checkTime(t); time = t; return fish.update(t); },
     setMode(next) { mode = modeName(next); fish.setCount(mode === 'school' ? 10 : 1); fish.update(time); return mode; },
     getMode: () => mode,
   };
   result.setMode(mode); return result;
 },
};
export const blueGuppyAdapter = {
 id: 'blue-guppy', camera: camera(18, 5, 35), modes: schoolingModes,
 async create(buffer, options = {}) {
   let mode = modeName(options.mode ?? 'single'), time = 0;
   const factory = await loadFish(blueGuppy, bytes(buffer));
   const solo = factory(soloGuppyRoute);
   const school = createGuppySchool(factory, new Group());
   const object = new Group(); object.name = 'blue-guppy-asset'; object.add(solo.object, school.object);
   const schoolMotion = { center: new Vector3(), heading: new Vector3(1,0,0), speed: 0 };
   function active() { return mode === 'school' ? school : solo; }
   function update(t) { checkTime(t); time = t; active().update(t); }
   function setMode(next) { mode = modeName(next); solo.object.visible = mode === 'single'; school.object.visible = mode === 'school'; update(time); return mode; }
   function getMotion() {
     if (mode === 'single') return solo.getMotion();
     schoolMotion.center.set(0,0,0);
     for (const child of school.object.children) schoolMotion.center.add(child.position);
     schoolMotion.center.divideScalar(school.object.children.length);
     schoolMotion.heading.set(1,0,0).applyQuaternion(school.object.children[0].quaternion);
     return schoolMotion;
   }
   setMode(mode);
   return { object, update, getMotion, setMode, getMode: () => mode, get duration() { return active().duration; } };
 },
};
export const fishAdapters = {
 'arowana': arowanaAdapter, 'vermilion-arowana': vermilionArowanaAdapter,
 'blue-guppy': blueGuppyAdapter, 'kohaku-koi': kohakuKoiAdapter,
 'silver-angelfish': silverAngelfishAdapter, 'cardinal-tetra': cardinalTetraAdapter,
 'sterbai-cory': sterbaiCoryAdapter,
};
