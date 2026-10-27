import type { EditCommand } from '../commands/history';
import type { PoseSnapshot } from './schema';

export function savePose(name: string, pose?: PoseSnapshot): EditCommand {
  const id = crypto.randomUUID();
  const snapshot = pose && structuredClone(pose);
  return {
    label: '保存姿势',
    apply(project) {
      project.poses.push({
        id,
        name: name.trim() || '未命名姿势',
        pose: structuredClone(snapshot ?? project.draft),
      });
    },
  };
}

export function loadPose(id: string): EditCommand {
  return {
    label: '加载姿势',
    apply(project) {
      const asset = project.poses.find((item) => item.id === id);
      if (asset) project.draft = structuredClone(asset.pose);
    },
  };
}
