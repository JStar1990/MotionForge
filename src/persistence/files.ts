import JSZip from 'jszip';
import { z } from 'zod';
import { parseProject, poseAssetSchema, rigSchema, type Project } from '../core/project/schema';

export type Assets = Record<string, Blob>;
const MAX_BYTES = 50 * 1024 * 1024;
const poseFileSchema = z.object({
  format: z.literal('motionforge-pose'),
  schemaVersion: z.literal(1),
  rig: rigSchema,
  asset: poseAssetSchema,
});

// All future migrations enter here, before runtime validation or state replacement.
export function migrateProject(input: unknown): Project {
  if (
    !input ||
    typeof input !== 'object' ||
    !('schemaVersion' in input) ||
    input.schemaVersion !== 1
  )
    throw new Error('不支持此工程版本，请使用兼容版本的 MotionForge。');
  return parseProject(input);
}

export function exportPose(project: Project, id?: string): string {
  const asset = id
    ? project.poses.find((item) => item.id === id)
    : { id: crypto.randomUUID(), name: '当前姿势', pose: project.draft };
  if (!asset) throw new Error('姿势不存在');
  return JSON.stringify(
    { format: 'motionforge-pose', schemaVersion: 1, rig: project.rig, asset },
    null,
    2,
  );
}

export function importPose(text: string, project: Project) {
  const file = poseFileSchema.parse(JSON.parse(text));
  if (JSON.stringify(file.rig) !== JSON.stringify(project.rig))
    throw new Error('姿势的骨架标识、版本或定义与当前工程不匹配。请打开原工程或使用相同骨架。');
  const asset = { ...file.asset, id: crypto.randomUUID() };
  parseProject({ ...project, poses: [...project.poses, asset] });
  return asset;
}

export async function exportProject(project: Project, assets: Assets = {}): Promise<Blob> {
  const valid = parseProject(project);
  const zip = new JSZip();
  zip.file('project.json', JSON.stringify(valid, null, 2));
  zip.folder('assets');
  for (const ref of valid.referenceImages) {
    const data = assets[ref.assetId];
    if (!data) throw new Error('工程参考图片缺失，无法生成完整备份。');
    zip.file(`assets/${encodeURIComponent(ref.assetId)}`, await data.arrayBuffer());
  }
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
}

export async function importProject(
  data: ArrayBuffer,
): Promise<{ project: Project; assets: Assets }> {
  if (data.byteLength > MAX_BYTES) throw new Error('工程文件超过 50 MB 限制。');
  const zip = await JSZip.loadAsync(data);
  const entries = Object.values(zip.files).filter((entry) => !entry.dir);
  // Check declared expanded sizes before decompressing project/assets.
  const expanded = entries.reduce(
    (sum, entry) =>
      sum +
      ((entry as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize ??
        MAX_BYTES + 1),
    0,
  );
  if (expanded > MAX_BYTES) throw new Error('工程解压后超过 50 MB 限制。');
  const json = zip.file('project.json');
  if (!json) throw new Error('工程中缺少 project.json。');
  const project = migrateProject(JSON.parse(await json.async('string')));
  const assets: Assets = {};
  for (const ref of project.referenceImages) {
    const entry = zip.file(`assets/${encodeURIComponent(ref.assetId)}`);
    if (!entry) throw new Error('工程参考图片缺失。');
    assets[ref.assetId] = await entry.async('blob');
  }
  return { project, assets };
}

export function download(data: Blob, name: string) {
  const url = URL.createObjectURL(data);
  const link = document.createElement('a');
  link.href = url;
  link.download = name.replace(/[<>:"/\\|?*]/g, '_');
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
