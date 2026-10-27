import { create } from 'zustand';
import {
  execute,
  redo,
  undo,
  type EditCommand,
  type HistoryState,
} from '../../core/commands/history';
import { createDefaultProject } from '../../core/project/defaultProject';

interface ProjectState extends HistoryState {
  dispatch: (command: EditCommand) => void;
  undo: () => void;
  redo: () => void;
}
export const useProjectStore = create<ProjectState>((set) => ({
  project: createDefaultProject(),
  past: [],
  future: [],
  dispatch: (command) => set((state) => execute(state, command)),
  undo: () => set((state) => undo(state)),
  redo: () => set((state) => redo(state)),
}));
