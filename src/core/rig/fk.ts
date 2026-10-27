import type { PoseSnapshot, RigDefinition, Vec2 } from '../project/schema';
import { rigForPose } from './bodyTurn';

export type WorldBone = { start: Vec2; end: Vec2; angle: number };
export function rotate(point: Vec2, angle: number): Vec2 {
  return {
    x: point.x * Math.cos(angle) - point.y * Math.sin(angle),
    y: point.x * Math.sin(angle) + point.y * Math.cos(angle),
  };
}

// Offsets are relative to the parent's origin, expressed in its rotated local axes.
export function forwardKinematics(
  rig: RigDefinition,
  pose: PoseSnapshot,
): Record<string, WorldBone> {
  const definitions = new Map(rigForPose(rig, pose).bones.map((bone) => [bone.id, bone]));
  const result: Record<string, WorldBone> = {};
  const visiting = new Set<string>();
  function resolve(id: string): WorldBone {
    if (Object.hasOwn(result, id)) return result[id];
    const bone = definitions.get(id);
    if (!bone || visiting.has(id)) throw new Error('无效的骨架层级');
    visiting.add(id);
    const parent = bone.parentId === null ? null : resolve(bone.parentId);
    const parentAngle = parent?.angle ?? pose.rootRotation;
    const origin = parent?.start ?? pose.rootPosition;
    const offset = rotate(bone.offset, parentAngle);
    const start = { x: origin.x + offset.x, y: origin.y + offset.y };
    const angle = parentAngle + bone.restAngle + pose.localRotations[id];
    const tip = rotate({ x: bone.length, y: 0 }, angle);
    visiting.delete(id);
    return (result[id] = { start, end: { x: start.x + tip.x, y: start.y + tip.y }, angle });
  }
  rig.bones.forEach((bone) => resolve(bone.id));
  return result;
}
