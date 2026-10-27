import Konva from 'konva';
import JSZip from 'jszip';
import type { PoseSnapshot, Project } from '../core/project/schema';
import { describeMannequin } from './mannequin';
import { describePose } from './drawing';
import { mannequinFill } from './style';
import { BYTE_BUDGET, exportPlan, type ExportMode, type ImageOptions } from './plan';

export async function renderPNG(
  project: Project,
  pose: PoseSnapshot,
  options: ImageOptions,
): Promise<Blob> {
  if (!options.mannequin && !options.skeleton) throw new Error('请至少选择一种人物显示方式。');
  if (options.background !== null && !/^#[0-9a-f]{6}$/i.test(options.background))
    throw new Error('背景颜色无效。');
  exportPlan(project, pose, 'pose');
  const host = document.createElement('div');
  const stage = new Konva.Stage({
    container: host,
    width: project.canvas.width,
    height: project.canvas.height,
  });
  const layer = new Konva.Layer({ listening: false });
  stage.add(layer);
  try {
    if (options.background)
      layer.add(
        new Konva.Rect({
          width: project.canvas.width,
          height: project.canvas.height,
          fill: options.background,
        }),
      );
    if (options.mannequin) {
      for (const part of describeMannequin(project.rig, pose)) {
        const fill = mannequinFill(part, pose);
        if (part.points)
          layer.add(
            new Konva.Line({
              points: part.points,
              closed: true,
              tension: 0.12,
              fill,
              stroke: '#525e70',
              strokeWidth: 2,
              lineJoin: 'round',
            }),
          );
        if (part.ellipse)
          layer.add(
            new Konva.Ellipse({
              x: part.ellipse.center.x,
              y: part.ellipse.center.y,
              radiusX: part.ellipse.radiusX,
              radiusY: part.ellipse.radiusY,
              rotation: part.ellipse.rotation,
              fill,
              stroke: '#525e70',
              strokeWidth: 2,
            }),
          );
        if (part.guide)
          layer.add(new Konva.Line({ points: part.guide, stroke: '#697589', strokeWidth: 1.5 }));
      }
    }
    if (options.skeleton) {
      for (const segment of describePose(project.rig, pose)) {
        layer.add(
          new Konva.Line({
            points: [segment.start.x, segment.start.y, segment.end.x, segment.end.y],
            stroke: segment.color,
            strokeWidth: options.mannequin ? 3 : 7,
            lineCap: 'round',
          }),
        );
        layer.add(
          new Konva.Circle({
            x: segment.start.x,
            y: segment.start.y,
            radius: options.mannequin ? 3 : 6,
            fill: '#1c212b',
            stroke: segment.color,
            strokeWidth: 3,
          }),
        );
        layer.add(
          new Konva.Circle({ x: segment.end.x, y: segment.end.y, radius: 4, fill: segment.color }),
        );
        if (segment.profile)
          layer.add(
            new Konva.Line({
              points: segment.profile,
              stroke: segment.color,
              strokeWidth: 3,
              lineJoin: 'round',
            }),
          );
      }
    }
    layer.draw();
    const canvas = stage.toCanvas({ pixelRatio: 1 });
    try {
      return await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error('无法生成 PNG，请降低导出尺寸。'))),
          'image/png',
        ),
      );
    } finally {
      canvas.width = 0;
      canvas.height = 0;
    }
  } finally {
    stage.destroy();
    host.remove();
  }
}

export async function exportImages(
  project: Project,
  pose: PoseSnapshot,
  mode: ExportMode,
  clipId: string | undefined,
  options: ImageOptions,
  signal: AbortSignal,
  progress: (done: number, total: number) => void,
) {
  const plan = exportPlan(project, pose, mode, clipId);
  const zip = new JSZip();
  let bytes = 0;
  let previousId: string | null = null;
  let previousData: ArrayBuffer | null = null;
  for (const [index, entry] of plan.entries()) {
    signal.throwIfAborted();
    const data: ArrayBuffer =
      entry.keyId && entry.keyId === previousId && previousData
        ? previousData
        : await (await renderPNG(project, entry.pose, options)).arrayBuffer();
    signal.throwIfAborted();
    previousId = entry.keyId;
    previousData = data;
    bytes += data.byteLength;
    if (bytes > BYTE_BUDGET) throw new Error('图片数据超过 128 MB，请分批导出。');
    if (mode === 'pose') return new Blob([data], { type: 'image/png' });
    zip.file(entry.file, data);
    progress(index + 1, plan.length);
    await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
  }
  signal.throwIfAborted();
  zip.file(
    'manifest.json',
    JSON.stringify(
      {
        format: 'motionforge-images',
        schemaVersion: 1,
        mode,
        width: project.canvas.width,
        height: project.canvas.height,
        fps: project.fps,
        background: options.background,
        mannequin: options.mannequin,
        skeleton: options.skeleton,
        includesReferenceImages: false,
        clipName: project.clips.find((clip) => clip.id === clipId)?.name,
        totalFrames: plan.at(-1)?.endFrame,
        imageCount: plan.length,
        images: plan.map((entry) => ({
          file: entry.file,
          keyId: entry.keyId,
          name: entry.name,
          startFrame: entry.startFrame,
          endFrame: entry.endFrame,
          durationFrames: entry.durationFrames,
        })),
      },
      null,
      2,
    ),
  );
  const result = await zip.generateAsync({ type: 'blob', compression: 'STORE' }, () =>
    signal.throwIfAborted(),
  );
  signal.throwIfAborted();
  return result;
}
