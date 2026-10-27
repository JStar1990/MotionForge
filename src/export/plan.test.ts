import { describe, expect, it } from 'vitest';
import { createDefaultProject } from '../core/project/defaultProject';
import { exportPlan } from './plan';

function fixture() {
  const project = createDefaultProject();
  project.clips.push({
    id: 'clip',
    name: '示例',
    keys: [3, 2, 4].map((durationFrames, i) => ({
      id: String(i),
      name: ['A', 'B', 'C'][i],
      durationFrames,
      pose: structuredClone(project.draft),
    })),
  });
  return project;
}

describe('图片导出规划', () => {
  it('关键姿势包保留 3/2/4 时长与帧区间', () => {
    const project = fixture();
    const plan = exportPlan(project, project.draft, 'keys', 'clip');
    expect(
      plan.map((entry) => [entry.file, entry.startFrame, entry.endFrame, entry.durationFrames]),
    ).toEqual([
      ['key_0001.png', 1, 3, 3],
      ['key_0002.png', 4, 5, 2],
      ['key_0003.png', 6, 9, 4],
    ]);
  });
  it('实际帧包为连续编号的 AAABBCCCC', () => {
    const project = fixture();
    const plan = exportPlan(project, project.draft, 'frames', 'clip');
    expect(plan.map((entry) => entry.name).join('')).toBe('AAABBCCCC');
    expect(plan.map((entry) => entry.startFrame)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(plan.at(-1)?.file).toBe('frame_0009.png');
    expect(plan[0].pose).toBe(plan[1].pose);
  });
  it('空动作、总像素预算和单张预算在分配画布前拒绝', () => {
    const project = fixture();
    expect(() => exportPlan(project, project.draft, 'keys', 'missing')).toThrow();
    project.clips[0].keys[0].durationFrames = 100;
    expect(() => exportPlan(project, project.draft, 'frames', 'clip')).toThrow(/预算/);
    expect(exportPlan(project, project.draft, 'keys', 'clip')).toHaveLength(3);
    project.canvas.width = 8192;
    project.canvas.height = 8192;
    expect(() => exportPlan(project, project.draft, 'pose')).toThrow(/单张/);
  });
});
