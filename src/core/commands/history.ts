import { parseProject, type Project } from '../project/schema';

export interface EditCommand {
  label: string;
  apply: (project: Project) => void;
}
export interface HistoryEntry {
  label: string;
  before: Project;
  after: Project;
}
export interface HistoryState {
  project: Project;
  past: HistoryEntry[];
  future: HistoryEntry[];
}
export const HISTORY_LIMIT = 100;

export function execute(state: HistoryState, command: EditCommand): HistoryState {
  const candidate = structuredClone(state.project);
  command.apply(candidate);
  // Revision belongs to the command system, never to the edit callback.
  candidate.revision = state.project.revision;
  const validated = parseProject(candidate);
  if (JSON.stringify(validated) === JSON.stringify(state.project)) return state;
  validated.revision++;
  const entry = {
    label: command.label,
    before: structuredClone(state.project),
    after: structuredClone(validated),
  };
  return { project: validated, past: [...state.past, entry].slice(-HISTORY_LIMIT), future: [] };
}

export function undo(state: HistoryState): HistoryState {
  const entry = state.past.at(-1);
  if (!entry) return state;
  return {
    project: { ...structuredClone(entry.before), revision: state.project.revision + 1 },
    past: state.past.slice(0, -1),
    future: [...state.future, entry],
  };
}

export function redo(state: HistoryState): HistoryState {
  const entry = state.future.at(-1);
  if (!entry) return state;
  return {
    project: { ...structuredClone(entry.after), revision: state.project.revision + 1 },
    past: [...state.past, entry],
    future: state.future.slice(0, -1),
  };
}
