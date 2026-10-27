import { create } from 'zustand';
import type { PoseSnapshot } from '../../core/project/schema';

interface UIState {
  selectedBoneId: string | null;
  resourceTab: 'bones' | 'poses' | 'references';
  previewPose: PoseSnapshot | null;
  showGrid: boolean;
  showMannequin: boolean;
  showSkeleton: boolean;
  showRoom: boolean;
  groundY: number;
  toggleRoom: () => void;
  setGroundY: (value: number) => void;
  viewport: { scale: number; x: number; y: number };
  selectBone: (id: string | null) => void;
  setTab: (tab: UIState['resourceTab']) => void;
  setPreview: (pose: PoseSnapshot | null) => void;
  setViewport: (viewport: UIState['viewport']) => void;
  toggleGrid: () => void;
  toggleMannequin: () => void;
  toggleSkeleton: () => void;
}
export const useUIStore = create<UIState>((set) => ({
  selectedBoneId: null,
  resourceTab: 'bones',
  previewPose: null,
  showGrid: true,
  showMannequin: true,
  showSkeleton: true,
  showRoom: true,
  groundY: 820,
  toggleRoom: () => set((state) => ({ showRoom: !state.showRoom })),
  setGroundY: (value) => {
    if (Number.isFinite(value)) set({ groundY: value });
  },
  viewport: { scale: 0.6, x: 0, y: 0 },
  selectBone: (selectedBoneId) => set({ selectedBoneId }),
  setTab: (resourceTab) => set({ resourceTab }),
  setPreview: (previewPose) => set({ previewPose }),
  setViewport: (viewport) => set({ viewport }),
  toggleGrid: () => set((state) => ({ showGrid: !state.showGrid })),
  toggleMannequin: () => set((state) => ({ showMannequin: !state.showMannequin })),
  toggleSkeleton: () => set((state) => ({ showSkeleton: !state.showSkeleton })),
}));
