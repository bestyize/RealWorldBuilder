import { Vector3 } from 'three';

// The bite point is measured at the mouth in model space and follows the head bone.
export function bindSwimMouth(object, bone, x, y, anchor = new Vector3()) {
  const point = new Vector3(x, y, 0);
  const local = bone.worldToLocal(object.localToWorld(point.clone()));
  return {
    mouthOffset: point.sub(anchor).multiply(object.scale),
    getMouth(target) {
      return bone.localToWorld(target.copy(local));
    },
  };
}
