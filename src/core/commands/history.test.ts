import { describe, expect, it } from 'vitest';
import { execute, undo, redo, HISTORY_LIMIT, type HistoryState } from './history';
import { createDefaultProject } from '../project/defaultProject';

const initial = (): HistoryState => ({
  project: createDefaultProject('history'),
  past: [],
  future: [],
});
const move = (x: number) => ({
  label: '移动',
  apply: (project: HistoryState['project']) => {
    project.draft.rootPosition.x = x;
  },
});

describe('编辑命令历史', () => {
  it('撤销/重做恢复完整数据，修订号始终递增', () => {
    const before = initial();
    const edited = execute(before, move(700));
    expect(before.project.draft.rootPosition.x).toBe(512);
    const undone = undo(edited);
    expect(undone.project.draft).toEqual(before.project.draft);
    const redone = redo(undone);
    expect(redone.project.draft).toEqual(edited.project.draft);
    expect([edited.project.revision, undone.project.revision, redone.project.revision]).toEqual([
      1, 2, 3,
    ]);
  });
  it('撤销后的新编辑清空重做分支，无效和无变化命令不增加历史', () => {
    const before = initial();
    expect(execute(before, move(512))).toBe(before);
    expect(() => execute(before, move(NaN))).toThrow();
    expect(before.past).toHaveLength(0);
    expect(execute(undo(execute(before, move(600))), move(800)).future).toHaveLength(0);
  });
  it('历史快照不与当前工程共享可变对象，限制历史容量', () => {
    let state = execute(initial(), move(600));
    state.project.draft.rootPosition.x = 123;
    expect(state.past[0].after.draft.rootPosition.x).toBe(600);
    for (let i = 0; i < 110; i++) state = execute(state, move(i));
    expect(state.past).toHaveLength(HISTORY_LIMIT);
  });
});
