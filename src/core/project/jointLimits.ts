import type { BoneDefinition, Project } from './schema';
import { syncControls } from '../rig/controls';

export function setJointLimit(
  project: Project,
  boneId: string,
  limit: BoneDefinition['angleLimit'],
) {
  const bone = project.rig.bones.find((item) => item.id === boneId);
  if (!bone) throw new Error('骨骼不存在');
  if (bone.angleLimit?.min === limit?.min && bone.angleLimit?.max === limit?.max) return;
  bone.angleLimit = limit;
  project.rig.revision++;
  const poses = [
    project.draft,
    ...project.poses.map((asset) => asset.pose),
    ...project.clips.flatMap((clip) => clip.keys.map((key) => key.pose)),
  ];
  for (const pose of poses) {
    pose.rigRevision = project.rig.revision;
    if (limit)
      pose.localRotations[boneId] = Math.max(
        limit.min,
        Math.min(limit.max, pose.localRotations[boneId]),
      );
    syncControls(project.rig, pose);
  }
}
