import { useEffect } from 'react';
import { playbackFrame } from '../../core/animation/transport';
import { usePlaybackStore } from '../state/playbackStore';
import { useProjectStore } from '../state/projectStore';

export function useTransport() {
  const { clipId, playing, loop } = usePlaybackStore();
  const project = useProjectStore((state) => state.project);
  const clip = project.clips.find((clip) => clip.id === clipId);
  const total = clip?.keys.reduce((sum, key) => sum + key.durationFrames, 0) ?? 0;
  useEffect(() => {
    const state = usePlaybackStore.getState();
    if (clipId && !clip) state.selectClip(null);
    else if (state.frame >= total) state.setFrame(Math.max(0, total - 1));
  }, [clipId, clip, total]);
  useEffect(() => {
    if (!playing || !total) return;
    const start = usePlaybackStore.getState().frame;
    const origin = performance.now();
    let request = 0;
    const tick = (now: number) => {
      const next = playbackFrame(start, now - origin, project.fps, total, loop);
      usePlaybackStore.setState(next);
      if (next.playing) request = requestAnimationFrame(tick);
    };
    request = requestAnimationFrame(tick);
    const hide = () => {
      if (document.hidden) usePlaybackStore.getState().pause();
    };
    document.addEventListener('visibilitychange', hide);
    return () => {
      cancelAnimationFrame(request);
      document.removeEventListener('visibilitychange', hide);
    };
  }, [playing, clipId, project.fps, total, loop]);
}
