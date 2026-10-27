import { keyIntervals } from '../core/animation/frames';
import type { PoseSnapshot, Project } from '../core/project/schema';

export type ExportMode = 'pose' | 'keys' | 'frames';
export type ImageOptions = { background: string | null; mannequin: boolean; skeleton: boolean };
export const PIXEL_BUDGET = 64 * 1024 * 1024;
export const BYTE_BUDGET = 128 * 1024 * 1024;
export function exportPlan(
  project: Project,
  pose: PoseSnapshot,
  mode: ExportMode,
  clipId?: string,
) {
  const clip = project.clips.find((item) => item.id === clipId);
  const intervals = clip ? keyIntervals(clip) : [];
  const total = intervals.at(-1)?.end ?? 0;
  if (mode !== 'pose' && !total) throw new Error('请选择包含关键姿势的动作。');
  const frames =
    mode === 'pose'
      ? [{ pose, keyId: null, name: '当前姿势', startFrame: 1, endFrame: 1, durationFrames: 1 }]
      : intervals.flatMap(({ key, start, end }) => {
          const base = {
            pose: key.pose,
            keyId: key.id,
            name: key.name,
            startFrame: start + 1,
            endFrame: end,
            durationFrames: key.durationFrames,
          };
          return mode === 'keys'
            ? [base]
            : Array.from({ length: key.durationFrames }, (_, offset) => ({
                ...base,
                startFrame: start + offset + 1,
                endFrame: start + offset + 1,
                durationFrames: 1,
              }));
        });
  if (project.canvas.width * project.canvas.height > 16 * 1024 * 1024)
    throw new Error('单张图片超过 1600 万像素限制。');
  const pixels = project.canvas.width * project.canvas.height * frames.length;
  if (pixels > PIXEL_BUDGET)
    throw new Error('本次导出超过 6400 万像素预算，请缩短动作或选择关键姿势图包。');
  return frames.map((frame, index) => ({
    ...frame,
    file:
      mode === 'pose'
        ? 'pose.png'
        : `${mode === 'keys' ? 'key' : 'frame'}_${String(index + 1).padStart(4, '0')}.png`,
  }));
}
