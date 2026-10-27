import { describe, expect, it } from 'vitest';
import { createDefaultProject } from '../project/defaultProject';
import { execute, undo, redo } from '../commands/history';
import { insertKey, poseCommand, reorderKey, resizeKey } from './editing';
import { playbackFrame } from './transport';
import { keyIntervals, sampleFrame } from './frames';

function fixture() {
  const project = createDefaultProject();
  project.clips.push({
    id: 'clip',
    name: '动作',
    keys: [3, 2, 4].map((durationFrames, index) => ({
      id: String(index),
      name: ['A', 'B', 'C'][index],
      durationFrames,
      pose: { ...structuredClone(project.draft), rootPosition: { x: 500 + index * 100, y: 500 } },
    })),
  });
  return project;
}

describe('时间轴编辑和播放', () => {
  it('3/2/4 帧严格采样，改变 FPS 不改变序列', () => {
    const project = fixture();
    expect(
      Array.from({ length: 9 }, (_, frame) => sampleFrame(project.clips[0], frame)?.name).join(''),
    ).toBe('AAABBCCCC');
    expect(keyIntervals(project.clips[0]).at(-1)?.end).toBe(9);
    expect(9 / 12).toBe(0.75);
    expect(9 / 24).toBe(0.375);
  });
  it('单调时间采样：循环无额外帧、非循环停在末帧、暂停后从当前帧继续', () => {
    expect(playbackFrame(0, 749, 12, 9, false)).toEqual({ frame: 8, playing: true });
    expect(playbackFrame(0, 750, 12, 9, false)).toEqual({ frame: 8, playing: false });
    expect(playbackFrame(0, 750, 12, 9, true)).toEqual({ frame: 0, playing: true });
    expect(playbackFrame(4, 250, 12, 9, false)).toEqual({ frame: 7, playing: true });
    expect(playbackFrame(0, 1000, 12, 0, true)).toEqual({ frame: 0, playing: false });
  });
  it('编辑 B 的整段，草稿和资产隔离，支持撤销重做', () => {
    const project = fixture();
    project.poses.push({
      id: 'asset',
      name: '原姿势',
      pose: structuredClone(project.clips[0].keys[1].pose),
    });
    const state = execute(
      { project, past: [], future: [] },
      poseCommand(
        {
          label: '移动',
          apply: (draft) => {
            draft.draft.rootPosition.x = 777;
          },
        },
        { clipId: 'clip', keyId: '1' },
      ),
    );
    expect(sampleFrame(state.project.clips[0], 3)?.pose.rootPosition.x).toBe(777);
    expect(sampleFrame(state.project.clips[0], 4)?.pose.rootPosition.x).toBe(777);
    expect(state.project.draft.rootPosition.x).toBe(512);
    expect(state.project.poses[0].pose.rootPosition.x).toBe(600);
    expect(undo(state).project).toEqual({ ...project, revision: 2 });
    expect(redo(undo(state)).project.clips[0].keys[1].pose.rootPosition.x).toBe(777);
  });
  it('插入深拷贝、排序和时长上限', () => {
    const project = fixture();
    let state = execute({ project, past: [], future: [] }, insertKey('clip', project.draft, 'D'));
    expect(state.project.clips[0].keys[3].pose).not.toBe(state.project.draft);
    state = execute(state, reorderKey('clip', '0', '2'));
    expect(state.project.clips[0].keys.map((key) => key.name)).toEqual(['B', 'C', 'A', 'D']);
    state = execute(state, resizeKey('clip', '1', 4000));
    expect(keyIntervals(state.project.clips[0]).at(-1)?.end).toBe(3000);
    const full = execute(state, insertKey('clip', project.draft, 'E'));
    expect(full.project.clips[0].keys).toHaveLength(4);
    expect(execute(state, resizeKey('clip', '1', -1)).project.clips[0].keys[0].durationFrames).toBe(
      1,
    );
  });
});
