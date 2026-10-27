import { sampleFrame } from '../../core/animation/frames';
import { poseCommand, type PoseTarget } from '../../core/animation/editing';
import type { EditCommand } from '../../core/commands/history';
import { useProjectStore } from './projectStore';
import { usePlaybackStore } from './playbackStore';

export function usePoseEditor() {
  const state = useProjectStore();
  const { clipId, frame, playing } = usePlaybackStore();
  const clip = state.project.clips.find((clip) => clip.id === clipId);
  const key = clip ? sampleFrame(clip, frame) : null;
  const target: PoseTarget = key && clip ? { clipId: clip.id, keyId: key.id } : null;
  const locked = playing || (!!clip && !key);
  return {
    ...state,
    project: key ? { ...state.project, draft: key.pose } : state.project,
    target,
    locked,
    clip,
    key,
    dispatch: (command: EditCommand) => {
      if (!locked) state.dispatch(poseCommand(command, target));
    },
    dispatchProject: state.dispatch,
  };
}
