import type { BoneDefinition, PoseSnapshot, RigDefinition, Vec2 } from '../project/schema';
import { forwardKinematics } from './fk';
import { solveConstrainedChain } from './constraints';
import { syncControls } from './controls';
import { rigForPose } from './bodyTurn';

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
function localAngle(bone: BoneDefinition, angle: number, previous: number) {
  const continuous = previous + Math.atan2(Math.sin(angle - previous), Math.cos(angle - previous));
  return bone.angleLimit ? clamp(continuous, bone.angleLimit.min, bone.angleLimit.max) : continuous;
}

/** Drag a bone endpoint in project space. Wrists/ankles solve their two-bone chain. */
export function dragBoneEndpoint(
  rig: RigDefinition,
  original: PoseSnapshot,
  boneId: string,
  target: Vec2,
  options: { mode?: 'ik' | 'fk'; bendSign?: 1 | -1 } = {},
) {
  const pose = structuredClone(original);
  const posedRig = rigForPose(rig, original);
  const bone = posedRig.bones.find((item) => item.id === boneId);
  if (!bone || !Number.isFinite(target.x) || !Number.isFinite(target.y))
    throw new Error('无效拖动目标');
  const world = forwardKinematics(rig, original);
  const chain =
    options.mode === 'fk' ? undefined : rig.ikChains.find((item) => item.lowerBoneId === boneId);
  let bendSign: 1 | -1 = 1;
  if (chain) {
    const upper = posedRig.bones.find((item) => item.id === chain.upperBoneId)!;
    const start = world[upper.id].start;
    const dx = target.x - start.x;
    const dy = target.y - start.y;
    const distance = Math.hypot(dx, dy);
    const previousTip = world[bone.id].end;
    const previousDistance = Math.hypot(previousTip.x - start.x, previousTip.y - start.y);
    const direction =
      distance > 1e-8
        ? Math.atan2(dy, dx)
        : previousDistance > 1e-8
          ? Math.atan2(previousTip.y - start.y, previousTip.x - start.x)
          : world[upper.id].angle;
    const cross = Math.sin(world[bone.id].angle - world[upper.id].angle);
    bendSign =
      options.bendSign ??
      (Math.abs(cross) > 1e-8 ? (cross > 0 ? -1 : 1) : original.ikControls[chain.id].bendSign);
    const d = clamp(
      distance,
      Math.max(Math.abs(upper.length - bone.length), 1e-8),
      upper.length + bone.length,
    );
    const alpha = Math.acos(
      clamp((upper.length ** 2 + d ** 2 - bone.length ** 2) / (2 * upper.length * d), -1, 1),
    );
    const upperAngle = direction + bendSign * alpha;
    const elbow = {
      x: start.x + upper.length * Math.cos(upperAngle),
      y: start.y + upper.length * Math.sin(upperAngle),
    };
    const solvedTarget = {
      x: start.x + d * Math.cos(direction),
      y: start.y + d * Math.sin(direction),
    };
    const lowerAngle = Math.atan2(solvedTarget.y - elbow.y, solvedTarget.x - elbow.x);
    const parentAngle = upper.parentId === null ? pose.rootRotation : world[upper.parentId].angle;
    pose.localRotations[upper.id] = localAngle(
      upper,
      upperAngle - parentAngle - upper.restAngle,
      original.localRotations[upper.id],
    );
    pose.localRotations[bone.id] = localAngle(
      bone,
      lowerAngle - upperAngle - bone.restAngle,
      original.localRotations[bone.id],
    );
    if (upper.angleLimit || bone.angleLimit) {
      const solution = solveConstrainedChain(
        upper,
        bone,
        parentAngle,
        start,
        target,
        original.localRotations[upper.id],
        original.localRotations[bone.id],
        bendSign,
      );
      pose.localRotations[upper.id] = solution.upperRotation;
      pose.localRotations[bone.id] = solution.lowerRotation;
    }
  } else {
    const start = world[bone.id].start;
    if (Math.hypot(target.x - start.x, target.y - start.y) > 1e-8) {
      const parentAngle = bone.parentId === null ? pose.rootRotation : world[bone.parentId].angle;
      pose.localRotations[bone.id] = localAngle(
        bone,
        Math.atan2(target.y - start.y, target.x - start.x) - parentAngle - bone.restAngle,
        original.localRotations[bone.id],
      );
    }
  }
  const solved = forwardKinematics(rig, pose);
  syncControls(rig, pose);
  if (chain)
    pose.ikControls[chain.id] = {
      ...pose.ikControls[chain.id],
      target: { ...target },
      bendSign,
      mode: 'ik',
    };
  const endpoint = solved[bone.id].end;
  return {
    pose,
    endpoint,
    error: Math.hypot(endpoint.x - target.x, endpoint.y - target.y),
    ik: !!chain,
  };
}
