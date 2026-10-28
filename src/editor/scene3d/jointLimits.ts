import * as THREE from 'three';

export type JointLimit = { x: [number, number]; y: [number, number]; z: [number, number] };
const range = (x: [number, number], y: [number, number], z: [number, number]): JointLimit => ({
  x,
  y,
  z,
});
/** Quaternius bind-relative XYZ authoring limits, in degrees. Not clinical ranges. */
export const jointLimits: Record<string, JointLimit> = {
  pelvis: range([-35, 35], [-45, 45], [-30, 30]),
  spine_01: range([-25, 35], [-25, 25], [-20, 20]),
  spine_02: range([-25, 35], [-30, 30], [-25, 25]),
  spine_03: range([-25, 35], [-35, 35], [-25, 25]),
  neck_01: range([-35, 45], [-50, 50], [-30, 30]),
  Head: range([-35, 35], [-45, 45], [-25, 25]),
};
for (const side of ['l', 'r']) {
  jointLimits[`clavicle_${side}`] = range([-30, 30], [-30, 30], [-35, 35]);
  jointLimits[`upperarm_${side}`] = range([-120, 120], [-85, 85], [-100, 100]);
  jointLimits[`lowerarm_${side}`] = range([0, 145], [-80, 80], [-5, 5]);
  jointLimits[`hand_${side}`] = range([-70, 70], [-30, 30], [-35, 35]);
  jointLimits[`thigh_${side}`] = range([-120, 45], [-45, 45], [-55, 55]);
  jointLimits[`calf_${side}`] = range([0, 150], [-5, 5], [-5, 5]);
  jointLimits[`foot_${side}`] = range([-35, 50], [-20, 20], [-25, 25]);
}

export function limitDelta(
  name: string,
  delta: THREE.Quaternion,
): { rotation: THREE.Quaternion; limited: boolean } {
  const limit = jointLimits[name];
  if (!limit) return { rotation: delta.clone(), limited: false };
  const angles = new THREE.Euler().setFromQuaternion(delta.clone().normalize(), 'XYZ');
  let limited = false;
  for (const axis of ['x', 'y', 'z'] as const) {
    const degrees = THREE.MathUtils.radToDeg(angles[axis]);
    const clamped = THREE.MathUtils.clamp(degrees, ...limit[axis]);
    if (Math.abs(degrees - clamped) > 1e-6) limited = true;
    angles[axis] = THREE.MathUtils.degToRad(clamped);
  }
  return {
    rotation: limited ? new THREE.Quaternion().setFromEuler(angles).normalize() : delta.clone(),
    limited,
  };
}

export function limitBone(bone: THREE.Bone, rest: THREE.Quaternion) {
  const result = limitDelta(bone.name, rest.clone().invert().multiply(bone.quaternion));
  if (result.limited) bone.quaternion.copy(rest).multiply(result.rotation).normalize();
  return result.limited;
}
