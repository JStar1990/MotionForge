import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { createDefaultProject } from '../core/project/defaultProject';
import { execute, undo } from '../core/commands/history';
import { loadPose, savePose } from '../core/project/poseAssets';
import { exportPose, exportProject, importPose, importProject, migrateProject } from './files';
import { SaveQueue } from './saveQueue';

describe('姿势与工程持久化', () => {
  it('保存、加载和撤销都保持快照隔离', () => {
    let state = execute(
      { project: createDefaultProject(), past: [], future: [] },
      savePose('站立'),
    );
    const id = state.project.poses[0].id;
    state = execute(state, {
      label: '移动',
      apply: (project) => {
        project.draft.rootPosition.x = 640;
      },
    });
    expect(state.project.poses[0].pose.rootPosition.x).toBe(512);
    state = execute(state, loadPose(id));
    expect(state.project.draft.rootPosition.x).toBe(512);
    expect(undo(state).project.draft.rootPosition.x).toBe(640);
    expect(state.project.draft).not.toBe(state.project.poses[0].pose);
  });
  it('姿势 JSON 往返并拒绝不兼容骨架及高版本', () => {
    const project = createDefaultProject();
    const text = exportPose(project);
    expect(importPose(text, project).pose).toEqual(project.draft);
    const changed = structuredClone(project);
    changed.rig.bones[0].length += 1;
    expect(() => importPose(text, changed)).toThrow(/骨架/);
    expect(() =>
      importPose(text.replace('"schemaVersion": 1', '"schemaVersion": 2'), project),
    ).toThrow();
  });
  it('工程 ZIP 保留完整数据和图片资源', async () => {
    const project = createDefaultProject();
    project.referenceImages.push({
      assetId: 'ref-1',
      position: { x: 1, y: 2 },
      scale: 1,
      opacity: 0.5,
      visible: true,
    });
    const blob = await exportProject(project, { 'ref-1': new Blob(['image-data']) });
    const restored = await importProject(await blob.arrayBuffer());
    expect(restored.project).toEqual(project);
    expect(await restored.assets['ref-1'].text()).toBe('image-data');
  });
  it('损坏、缺少资源和未知版本工程拒绝读取，旧字段可迁移', async () => {
    await expect(importProject(new ArrayBuffer(20))).rejects.toThrow();
    const project = createDefaultProject();
    expect(() => migrateProject({ ...project, schemaVersion: 99 })).toThrow(/版本/);
    const old = JSON.parse(JSON.stringify(project));
    delete old.draft.bodyTurn;
    expect(migrateProject(old).draft.bodyTurn).toBe(0);
    project.referenceImages.push({
      assetId: 'missing',
      position: { x: 0, y: 0 },
      scale: 1,
      opacity: 1,
      visible: true,
    });
    const zip = new JSZip().file('project.json', JSON.stringify(project));
    await expect(importProject(await zip.generateAsync({ type: 'arraybuffer' }))).rejects.toThrow(
      /图片缺失/,
    );
  });
  it('保存串行、入队时捕获快照，失败后仍能保存下一修订', async () => {
    const revisions: number[] = [];
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const queue = new SaveQueue(async (project) => {
      if (project.revision === 0) {
        await gate;
        throw new Error('quota');
      }
      revisions.push(project.revision);
    });
    const project = createDefaultProject();
    const first = queue.enqueue(project, {});
    const failure = expect(first).rejects.toThrow('quota');
    project.revision = 1;
    const second = queue.enqueue(project, {});
    project.revision = 2;
    const third = queue.enqueue(project, {});
    project.revision = 3;
    expect(revisions).toEqual([]);
    release();
    await failure;
    await second;
    await third;
    expect(revisions).toEqual([1, 2]);
  });
});
