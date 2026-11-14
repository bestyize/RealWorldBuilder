import { MathUtils } from 'three';

export const swimAspect = 16 / 9;

export function fitSwimCamera(camera, width, height, baseFov) {
  camera.aspect = width / height;
  // Keep the original horizontal swim range in a narrower viewport.
  const verticalScale = Math.max(1, swimAspect / camera.aspect);
  camera.fov = MathUtils.radToDeg(2 * Math.atan(Math.tan(MathUtils.degToRad(baseFov) / 2) * verticalScale));
  camera.updateProjectionMatrix();
}
