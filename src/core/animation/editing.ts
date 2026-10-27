import type { PoseSnapshot, Project } from '../project/schema';
import type { EditCommand } from '../commands/history';

export type PoseTarget = { clipId: string; keyId: string } | null;
export function targetPose(project: Project, target: PoseTarget): PoseSnapshot {
  if (!target) return project.draft;
  const key = project.clips
    .find((clip) => clip.id === target.clipId)
    ?.keys.find((key) => key.id === target.keyId);
  if (!key) throw new Error('关键姿势不存在');
  return key.pose;
}
export function poseCommand(command: EditCommand, target: PoseTarget): EditCommand {
  if (!target) return command;
  // Adapt existing pose-only editors; the independent draft never enters the edit.
  return {
    label: command.label,
    apply(project) {
      const key = project.clips
        .find((clip) => clip.id === target.clipId)
        ?.keys.find((key) => key.id === target.keyId);
      if (!key) return;
      const working = { ...project, draft: structuredClone(key.pose) };
      command.apply(working);
      key.pose = working.draft;
    },
  };
}

export function insertKey(
  clipId: string,
  pose: PoseSnapshot,
  name: string,
  afterId?: string,
): EditCommand {
  const snapshot = structuredClone(pose);
  const id = crypto.randomUUID();
  return {
    label: '添加关键姿势',
    apply(project) {
      const clip = project.clips.find((clip) => clip.id === clipId);
      if (!clip || clip.keys.length >= 300) return;
      const remaining = 3000 - clip.keys.reduce((sum, key) => sum + key.durationFrames, 0);
      if (remaining < 1) return;
      const key = {
        id,
        name: name.trim() || '关键姿势',
        pose: structuredClone(snapshot),
        durationFrames: Math.min(project.defaultDurationFrames, remaining),
      };
      const index = afterId
        ? clip.keys.findIndex((key) => key.id === afterId)
        : clip.keys.length - 1;
      clip.keys.splice(index + 1, 0, key);
    },
  };
}
export function resizeKey(clipId: string, keyId: string, duration: number): EditCommand {
  return {
    label: '调整持续帧数',
    apply(project) {
      const clip = project.clips.find((clip) => clip.id === clipId);
      const key = clip?.keys.find((key) => key.id === keyId);
      if (!clip || !key || !Number.isFinite(duration)) return;
      const other = clip.keys.reduce(
        (sum, item) => sum + (item.id === keyId ? 0 : item.durationFrames),
        0,
      );
      key.durationFrames = Math.max(1, Math.min(3000 - other, Math.round(duration)));
    },
  };
}
export function reorderKey(clipId: string, keyId: string, destinationId: string): EditCommand {
  return {
    label: '调整关键姿势顺序',
    apply(project) {
      const clip = project.clips.find((clip) => clip.id === clipId);
      if (!clip) return;
      const from = clip.keys.findIndex((key) => key.id === keyId);
      const to = clip.keys.findIndex((key) => key.id === destinationId);
      if (from < 0 || to < 0 || from === to) return;
      const [key] = clip.keys.splice(from, 1);
      clip.keys.splice(to, 0, key);
    },
  };
}
