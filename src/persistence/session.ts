import { create } from 'zustand';
import { useProjectStore } from '../editor/state/projectStore';
import { useUIStore } from '../editor/state/uiStore';
import { usePlaybackStore } from '../editor/state/playbackStore';
import { parseProject, type Project } from '../core/project/schema';
import { restoreProject, writeProject } from './database';
import type { Assets } from './files';
import { SaveQueue } from './saveQueue';

export const useSaveStatus = create<{
  status: 'loading' | 'saving' | 'saved' | 'error';
  message: string;
}>(() => ({ status: 'loading', message: '正在恢复工程…' }));
let assets: Assets = {};
let generation = 0;
const queue = new SaveQueue(writeProject);
export const currentAssets = () => assets;

export async function saveCurrent() {
  const token = ++generation;
  useSaveStatus.setState({ status: 'saving', message: '正在自动保存…' });
  try {
    await queue.enqueue(useProjectStore.getState().project, assets);
    if (token === generation)
      useSaveStatus.setState({ status: 'saved', message: '已自动保存到本机' });
    return true;
  } catch {
    if (token === generation)
      useSaveStatus.setState({ status: 'error', message: '本地保存失败，请下载备份后再关闭页面' });
    return false;
  }
}

export function replaceProject(project: Project, nextAssets: Assets = {}) {
  const valid = parseProject(project);
  assets = nextAssets;
  useUIStore.setState({ selectedBoneId: null, previewPose: null });
  usePlaybackStore.getState().selectClip(null);
  useProjectStore.setState({ project: valid, past: [], future: [] });
}

export async function initializePersistence() {
  let failed = false;
  try {
    const restored = await restoreProject();
    if (restored) replaceProject(restored.project, restored.assets);
    useSaveStatus.setState({
      status: 'saved',
      message: restored ? '已恢复上次工程' : '本机自动保存已开启',
    });
  } catch {
    failed = true;
    useSaveStatus.setState({
      status: 'error',
      message: '本地工程恢复失败；可打开备份，当前编辑仍可下载保存',
    });
  }
  useProjectStore.subscribe((state, previous) => {
    if (state.project !== previous.project) void saveCurrent();
  });
  window.addEventListener('beforeunload', (event) => {
    if (useSaveStatus.getState().status !== 'saved' || useUIStore.getState().previewPose) {
      event.preventDefault();
      event.returnValue = '';
    }
  });
  if (!failed) void saveCurrent();
}
