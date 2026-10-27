export function playbackFrame(
  start: number,
  elapsedMs: number,
  fps: number,
  total: number,
  loop: boolean,
) {
  if (total <= 0) return { frame: 0, playing: false };
  const frame = start + Math.floor((Math.max(0, elapsedMs) * fps) / 1000);
  return loop
    ? { frame: frame % total, playing: true }
    : { frame: Math.min(frame, total - 1), playing: frame < total };
}
