import { useRef, useState } from 'react';
import { createDefaultProject } from '../../core/project/defaultProject';
import { download, exportProject, importProject } from '../../persistence/files';
import {
  currentAssets,
  replaceProject,
  saveCurrent,
  useSaveStatus,
} from '../../persistence/session';
import { useProjectStore } from '../state/projectStore';
import { useUIStore } from '../state/uiStore';

export function ProjectFiles() {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const dragging = useUIStore((state) => state.previewPose !== null);
  async function canReplace() {
    if (useSaveStatus.getState().status === 'saved' || (await saveCurrent())) return true;
    return window.confirm(
      '当前工程尚未保存到本机。建议取消并先点击“保存备份”。仍要离开当前工程吗？',
    );
  }
  async function backup() {
    setBusy(true);
    try {
      const project = useProjectStore.getState().project;
      download(await exportProject(project, currentAssets()), `${project.name}.motionforge`);
      setMessage('工程备份已下载');
    } catch {
      setMessage('备份失败，请保留此页面并重试。');
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <button
        disabled={busy || dragging}
        onClick={async () => {
          setBusy(true);
          try {
            if (await canReplace()) {
              replaceProject(createDefaultProject());
              setMessage('已新建工程');
            }
          } finally {
            setBusy(false);
          }
        }}
      >
        新建工程
      </button>
      <button disabled={busy || dragging} onClick={() => input.current?.click()}>
        打开工程
      </button>
      <button disabled={busy || dragging} onClick={() => void backup()}>
        保存备份
      </button>
      <input
        ref={input}
        type="file"
        hidden
        accept=".motionforge"
        aria-label="选择工程文件"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (!file) return;
          setBusy(true);
          try {
            if (file.size > 50 * 1024 * 1024) throw new Error('工程文件超过 50 MB 限制。');
            const loaded = await importProject(await file.arrayBuffer());
            if (await canReplace()) {
              // Import as a local copy, so an older backup never overwrites the original revision.
              replaceProject({ ...loaded.project, id: crypto.randomUUID() }, loaded.assets);
              setMessage('工程已打开，可继续编辑');
            }
          } catch {
            setMessage('打开失败：文件损坏、版本不支持或资源缺失。当前工程未更改。');
          } finally {
            setBusy(false);
          }
        }}
      />
      {message && (
        <div className="file-notice" role="status">
          {message}
          <button aria-label="关闭提示" onClick={() => setMessage('')}>
            ×
          </button>
        </div>
      )}
    </>
  );
}
