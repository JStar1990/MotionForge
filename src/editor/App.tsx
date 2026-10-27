import { useEffect } from 'react';
import { PoseCanvas } from './canvas/PoseCanvas';
import { Resources } from './panels/Resources';
import { Properties } from './panels/Properties';
import { Timeline } from './timeline/Timeline';
import { usePoseEditor } from './state/usePoseEditor';
import { usePlaybackStore } from './state/playbackStore';
import { useUIStore } from './state/uiStore';
import { createDefaultPose } from '../core/rig/defaultRig';
import { ProjectFiles } from './panels/ProjectFiles';
import { ExportImages } from './panels/ExportImages';
import { saveCurrent, useSaveStatus } from '../persistence/session';

export function App() {
  const { project, past, future, undo, redo, dispatch, locked } = usePoseEditor();
  const dragging = useUIStore((state) => state.previewPose !== null);
  const save = useSaveStatus();
  const playing = usePlaybackStore((state) => state.playing);
  useEffect(() => {
    function shortcut(event: KeyboardEvent) {
      if (
        event.target instanceof HTMLElement &&
        event.target.closest('dialog, input, textarea, select, [contenteditable="true"]')
      )
        return;
      if (useUIStore.getState().previewPose || usePlaybackStore.getState().playing) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') {
        event.preventDefault();
        redo();
      }
    }
    window.addEventListener('keydown', shortcut);
    return () => window.removeEventListener('keydown', shortcut);
  }, [undo, redo]);
  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-icon">M</span>
          <strong>
            Motion<span>Forge</span>
          </strong>
          <span className="version">开发预览</span>
        </div>
        <span className="project-name">{project.name}</span>
        <div className="top-actions">
          <ProjectFiles />
          <ExportImages />
        </div>
      </header>
      <div className="workspace-toolbar">
        <div>
          <span className="workspace-label">姿势编辑</span>
          <span className="divider" />
          <button disabled={playing || dragging || !past.length} onClick={undo} title="Ctrl+Z">
            ↶ 撤销
          </button>
          <button
            disabled={playing || dragging || !future.length}
            onClick={redo}
            title="Ctrl+Shift+Z"
          >
            ↷ 重做
          </button>
          <button
            disabled={locked || dragging}
            onClick={() =>
              dispatch({
                label: '重置姿势',
                apply: (draft) => {
                  draft.draft = createDefaultPose(draft.rig, draft.draft.bodyTurn);
                },
              })
            }
          >
            重置姿势
          </button>
        </div>
        <span className="local-status" role="status">
          ● {save.message} · 修订 {project.revision}
          {save.status === 'error' && <button onClick={() => void saveCurrent()}>重试保存</button>}
        </span>
      </div>
      <div className="workspace">
        <Resources />
        <PoseCanvas />
        <Properties />
      </div>
      <Timeline />
      <footer className="statusbar">
        <span>MotionForge / M3 时间轴与播放</span>
        <span>
          {past.at(-1)?.label ?? '就绪'} · {project.rig.ikChains.length} 条 IK 链定义
        </span>
      </footer>
    </main>
  );
}
