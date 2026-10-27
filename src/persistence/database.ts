import Dexie, { type Table } from 'dexie';
import type { Project } from '../core/project/schema';
import { migrateProject, type Assets } from './files';

class MotionDatabase extends Dexie {
  projects!: Table<{ id: string; project: Project }>;
  assets!: Table<{ id: string; projectId: string; assetId: string; data: Blob }>;
  settings!: Table<{ key: string; value: string }>;
  constructor() {
    super('motionforge');
    this.version(1).stores({ projects: 'id', assets: 'id, projectId', settings: 'key' });
  }
}
export const database = new MotionDatabase();

export async function writeProject(project: Project, assets: Assets) {
  await database.transaction(
    'rw',
    database.projects,
    database.assets,
    database.settings,
    async () => {
      const existing = await database.projects.get(project.id);
      if (existing && existing.project.revision > project.revision)
        throw new Error('检测到较新工程，请备份当前编辑后重新打开。');
      await database.projects.put({ id: project.id, project });
      await database.assets.where('projectId').equals(project.id).delete();
      for (const [assetId, data] of Object.entries(assets))
        await database.assets.put({
          id: JSON.stringify([project.id, assetId]),
          projectId: project.id,
          assetId,
          data,
        });
      await database.settings.put({ key: 'lastProject', value: project.id });
    },
  );
}

export async function restoreProject() {
  const last = await database.settings.get('lastProject');
  if (!last) return null;
  const row = await database.projects.get(last.value);
  if (!row) throw new Error('找不到上次工程');
  const project = migrateProject(row.project);
  const rows = await database.assets.where('projectId').equals(project.id).toArray();
  const assets: Assets = Object.fromEntries(rows.map((row) => [row.assetId, row.data]));
  if (project.referenceImages.some((ref) => !assets[ref.assetId])) throw new Error('参考图片缺失');
  return { project, assets };
}
