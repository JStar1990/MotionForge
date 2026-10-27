import type { Clip } from '../project/schema';

export function keyIntervals(clip: Clip) {
  let end = 0;
  return clip.keys.map((key) => {
    const start = end;
    end += key.durationFrames;
    return { key, start, end };
  });
}

export function sampleFrame(clip: Clip, frame: number) {
  if (!Number.isInteger(frame) || frame < 0) return null;
  return (
    keyIntervals(clip).find((interval) => frame >= interval.start && frame < interval.end)?.key ??
    null
  );
}
