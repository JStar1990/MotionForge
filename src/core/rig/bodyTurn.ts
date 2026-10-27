import type { PoseSnapshot, RigDefinition } from '../project/schema';

/** A 2D profile adjustment, not a 3D camera rotation. The authoritative rig stays unchanged. */
export function rigForPose(rig: RigDefinition, pose: PoseSnapshot): RigDefinition {
  const turn = pose.bodyTurn ?? 0;
  if (turn === 0 || rig.id !== 'human-2d-v1') return rig;
  const amount = Math.abs(turn) / 90;
  const facing = Math.sign(turn);
  // Keep a small separation so both sides remain visible and editable in profile.
  const width = Math.max(0.08, Math.cos((amount * Math.PI) / 2));
  const blendAngle = (from: number, to: number) =>
    from + Math.atan2(Math.sin(to - from), Math.cos(to - from)) * amount;
  const sideAngles: Record<string, number> = {
    leftUpperArm: 90,
    rightUpperArm: -90,
    leftForearm: -15 * facing,
    rightForearm: -15 * facing,
    leftThigh: 180 - 6 * facing,
    rightThigh: -180 - 6 * facing,
    leftShin: 9 * facing,
    rightShin: 9 * facing,
    leftFoot: facing > 0 ? -93 : 93,
    rightFoot: facing > 0 ? -93 : 93,
  };
  return {
    ...rig,
    bones: rig.bones.map((bone) => {
      const result = { ...bone, offset: { ...bone.offset } };
      if (bone.id === 'leftShoulder' || bone.id === 'rightShoulder') result.length *= width;
      if (bone.id === 'leftUpperArm' || bone.id === 'rightUpperArm') result.offset.x *= width;
      if (bone.id === 'leftThigh' || bone.id === 'rightThigh') result.offset.y *= width;
      if (sideAngles[bone.id] !== undefined)
        result.restAngle = blendAngle(bone.restAngle, (sideAngles[bone.id] * Math.PI) / 180);
      return result;
    }),
  };
}

export function poseDrawOrder(rig: RigDefinition, pose: PoseSnapshot): string[] {
  if (!pose.bodyTurn || rig.id !== 'human-2d-v1') return rig.drawOrder;
  const near = pose.bodyTurn > 0 ? 'left' : 'right';
  const sides = new Map(rig.bones.map((bone) => [bone.id, bone.side]));
  const rank = (id: string) => (sides.get(id) === near ? 2 : sides.get(id) === 'center' ? 1 : 0);
  return [...rig.drawOrder].sort((a, b) => rank(a) - rank(b));
}
