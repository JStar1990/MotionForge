import * as THREE from 'three';

export const limbChains: Record<string, [string, string]> = {
  hand_l: ['upperarm_l', 'lowerarm_l'],
  hand_r: ['upperarm_r', 'lowerarm_r'],
  foot_l: ['thigh_l', 'calf_l'],
  foot_r: ['thigh_r', 'calf_r'],
};
const world = (bone: THREE.Object3D) => bone.getWorldPosition(new THREE.Vector3());

/** Rotate a joint in world space without changing its bind translation or scale. */
function aim(bone: THREE.Bone, child: THREE.Bone, destination: THREE.Vector3) {
  const origin = world(bone);
  const from = world(child).sub(origin).normalize();
  const to = destination.clone().sub(origin).normalize();
  const parent = bone.parent!.getWorldQuaternion(new THREE.Quaternion());
  const rotation = new THREE.Quaternion().setFromUnitVectors(from, to);
  bone.quaternion
    .copy(parent.clone().invert().multiply(rotation).multiply(parent).multiply(bone.quaternion))
    .normalize();
  bone.updateWorldMatrix(false, true);
}

/** Analytic two-bone IK. The pole is a world point frozen at gesture start. */
export function solveLimb(
  upper: THREE.Bone,
  lower: THREE.Bone,
  end: THREE.Bone,
  target: THREE.Vector3,
  pole: THREE.Vector3,
  constrain?: (bone: THREE.Bone) => void,
) {
  const a = world(upper),
    b = world(lower),
    c = world(end);
  const l1 = a.distanceTo(b),
    l2 = b.distanceTo(c);
  if (l1 < 1e-7 || l2 < 1e-7 || ![...target.toArray(), ...pole.toArray()].every(Number.isFinite))
    return Infinity;
  const direction = target.clone().sub(a);
  const distance = direction.length();
  if (distance < 1e-7) direction.copy(c).sub(a);
  if (direction.lengthSq() < 1e-12) direction.set(1, 0, 0);
  direction.normalize();
  const reach = THREE.MathUtils.clamp(distance, Math.abs(l1 - l2) + 1e-6, l1 + l2 - 1e-6);
  const bend = pole.clone().sub(a).addScaledVector(direction, -pole.clone().sub(a).dot(direction));
  if (bend.lengthSq() < 1e-10) {
    bend.set(0, 0, 1).addScaledVector(direction, -direction.z);
    if (bend.lengthSq() < 1e-10) bend.set(0, 1, 0).addScaledVector(direction, -direction.y);
  }
  bend.normalize();
  const along = (l1 * l1 - l2 * l2 + reach * reach) / (2 * reach);
  const elbow = a
    .clone()
    .addScaledVector(direction, along)
    .addScaledVector(bend, Math.sqrt(Math.max(0, l1 * l1 - along * along)));
  const goal = a.clone().addScaledVector(direction, reach);
  const orientation = end.getWorldQuaternion(new THREE.Quaternion());
  aim(upper, lower, elbow);
  constrain?.(upper);
  upper.updateWorldMatrix(false, true);
  aim(lower, end, goal);
  constrain?.(lower);
  lower.updateWorldMatrix(false, true);
  end.quaternion
    .copy(end.parent!.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(orientation))
    .normalize();
  constrain?.(end);
  end.updateWorldMatrix(false, true);
  return world(end).distanceTo(target);
}

export function initialPole(upper: THREE.Bone, lower: THREE.Bone, end: THREE.Bone) {
  const a = world(upper),
    b = world(lower),
    direction = world(end).sub(a).normalize();
  const bend = b.clone().sub(a).addScaledVector(direction, -b.clone().sub(a).dot(direction));
  if (bend.lengthSq() < 1e-6) {
    // Stable fallback for the straight bind pose: knees forward, elbows backward.
    bend.set(0, 0, upper.name.startsWith('thigh') ? 1 : -1);
    bend.addScaledVector(direction, -bend.dot(direction));
    if (bend.lengthSq() < 1e-10) bend.set(0, 1, 0).addScaledVector(direction, -direction.y);
  }
  return a.add(bend.normalize());
}
