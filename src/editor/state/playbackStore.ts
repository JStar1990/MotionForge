import { create } from 'zustand';

interface PlaybackState {
  clipId: string | null;
  onion: boolean;
  onionOpacity: number;
  selectClip: (clipId: string | null) => void;
  frame: number;
  playing: boolean;
  loop: boolean;
  setFrame: (frame: number) => void;
  pause: () => void;
}
// Transport state never enters project history or pose snapshots.
export const usePlaybackStore = create<PlaybackState>((set) => ({
  clipId: null,
  onion: false,
  onionOpacity: 0.25,
  selectClip: (clipId) => set({ clipId, frame: 0, playing: false }),
  frame: 0,
  playing: false,
  loop: true,
  setFrame: (frame) => set({ frame: Math.max(0, Math.floor(frame)), playing: false }),
  pause: () => set({ playing: false }),
}));
