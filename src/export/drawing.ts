import type { PoseSnapshot, RigDefinition } from '../core/project/schema';
import { forwardKinematics } from '../core/rig/fk';
import { poseDrawOrder } from '../core/rig/bodyTurn';

export const boneColors = { left: '#68d5b5', right: '#a89afb', center: '#dbe2ee' };

// Shared project-space description for editor drawing and later PNG rendering.
export function describePose(rig: RigDefinition, pose: PoseSnapshot) {
  const world = forwardKinematics(rig, pose);
  const bones = new Map(rig.bones.map((bone) => [bone.id, bone]));
  return poseDrawOrder(rig, pose).map((id) => {
    const segment = world[id];
    let profile: number[] | undefined;
    if (id === 'head' && pose.bodyTurn) {
      const along = { x: Math.cos(segment.angle), y: Math.sin(segment.angle) };
      const across = { x: -along.y, y: along.x };
      const nose = (25 * pose.bodyTurn) / 90;
      const base = { x: segment.end.x - along.x * 16, y: segment.end.y - along.y * 16 };
      profile = [
        base.x,
        base.y,
        base.x + across.x * nose - along.x * 8,
        base.y + across.y * nose - along.y * 8,
        base.x - along.x * 16,
        base.y - along.y * 16,
      ];
    }
    return { id, ...segment, color: boneColors[bones.get(id)!.side], profile };
  });
}
