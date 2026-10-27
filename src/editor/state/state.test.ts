import { beforeEach, expect, it } from 'vitest';
import { createDefaultProject } from '../../core/project/defaultProject';
import { useProjectStore } from './projectStore';
import { useUIStore } from './uiStore';
import { usePlaybackStore } from './playbackStore';

beforeEach(() => {
  useProjectStore.setState({ project: createDefaultProject('store'), past: [], future: [] });
  useUIStore.getState().setPreview(null);
});

it('视口、选择、播放帧和拖动预览不改变工程或命令历史', () => {
  const before = structuredClone(useProjectStore.getState().project);
  const preview = structuredClone(before.draft);
  preview.rootPosition.x = 800;
  useUIStore.getState().setPreview(preview);
  useUIStore.getState().selectBone('head');
  useUIStore.getState().setViewport({ x: 100, y: -50, scale: 2 });
  usePlaybackStore.getState().setFrame(8);
  expect(useProjectStore.getState().project).toEqual(before);
  expect(useProjectStore.getState().past).toHaveLength(0);
  useUIStore.getState().setPreview(null);
  expect(useProjectStore.getState().project.draft.rootPosition.x).toBe(512);
});
