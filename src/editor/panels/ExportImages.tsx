import { useEffect, useRef, useState } from 'react';
import type { Project } from '../../core/project/schema';
import { exportPlan, type ExportMode, type ImageOptions } from '../../export/plan';
import { download } from '../../persistence/files';
import { usePoseEditor } from '../state/usePoseEditor';
import { useUIStore } from '../state/uiStore';
import { usePlaybackStore } from '../state/playbackStore';

function ExportDialog({
  project,
  initialClipId,
  onClose,
}: {
  project: Project;
  initialClipId?: string;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const controller = useRef<AbortController | null>(null);
  const [mode, setMode] = useState<ExportMode>('pose');
  const [clipId, setClipId] = useState(initialClipId ?? project.clips[0]?.id ?? '');
  const [options, setOptions] = useState<ImageOptions>({
    background: null,
    mannequin: true,
    skeleton: false,
  });
  const [color, setColor] = useState('#ffffff');
  const [preview, setPreview] = useState('');
  const [previewError, setPreviewError] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [message, setMessage] = useState('');
  const clip = project.clips.find((item) => item.id === clipId);
  const pose = mode === 'pose' ? project.draft : clip?.keys[0]?.pose;
  let count = 0;
  let problem = '';
  try {
    count = exportPlan(project, project.draft, mode, clipId).length;
    if (!options.mannequin && !options.skeleton) problem = '请至少选择假人或骨架线。';
  } catch (error) {
    problem = error instanceof Error ? error.message : '无法导出';
  }
  useEffect(() => {
    dialog.current?.showModal();
    return () => controller.current?.abort();
  }, []);
  useEffect(() => {
    let disposed = false;
    let url = '';
    if (pose)
      void import('../../export/images')
        .then(({ renderPNG }) => renderPNG(project, pose, options))
        .then((blob) => {
          if (disposed) return;
          url = URL.createObjectURL(blob);
          setPreview(url);
          setPreviewError('');
        })
        .catch((error: unknown) => {
          if (!disposed) {
            setPreview('');
            setPreviewError(error instanceof Error ? error.message : '预览失败');
          }
        });
    return () => {
      disposed = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [project, pose, options]);
  async function generate() {
    const abort = new AbortController();
    controller.current = abort;
    setBusy(true);
    setMessage('');
    setProgress({ done: 0, total: count });
    try {
      const { exportImages } = await import('../../export/images');
      const blob = await exportImages(
        project,
        project.draft,
        mode,
        clipId,
        options,
        abort.signal,
        (done, total) => setProgress({ done, total }),
      );
      abort.signal.throwIfAborted();
      download(
        blob,
        `${mode === 'pose' ? '当前姿势' : (clip?.name ?? '动作')}${mode === 'pose' ? '.png' : mode === 'keys' ? '-关键姿势.zip' : '-播放帧.zip'}`,
      );
      setMessage(`已下载 ${count} 张图片${mode === 'pose' ? '' : '和帧序说明文件'}。`);
    } catch (error) {
      setMessage(
        abort.signal.aborted
          ? '已取消导出，工程未改变。'
          : error instanceof Error
            ? error.message
            : '导出失败，请重试。',
      );
    } finally {
      setBusy(false);
      controller.current = null;
    }
  }
  return (
    <dialog
      ref={dialog}
      className="export-dialog"
      aria-label="导出动作图"
      onCancel={(event) => {
        event.preventDefault();
        if (busy) controller.current?.abort();
        else onClose();
      }}
    >
      <div className="export-heading">
        <h2>导出动作图</h2>
        <button disabled={busy} onClick={onClose} aria-label="关闭导出">
          ×
        </button>
      </div>
      <div className="export-layout">
        <div className="export-preview">
          {pose && preview && !previewError ? (
            <img src={preview} alt="最终图片预览" />
          ) : (
            <p>{previewError || (pose ? '正在生成预览…' : '动作中没有姿势')}</p>
          )}
        </div>
        <div>
          <fieldset disabled={busy}>
            <label>
              导出内容
              <select
                aria-label="导出内容"
                value={mode}
                onChange={(event) => setMode(event.target.value as ExportMode)}
              >
                <option value="pose">当前姿势 PNG</option>
                <option value="keys">关键姿势图包</option>
                <option value="frames">实际播放帧图包</option>
              </select>
            </label>
            {mode !== 'pose' && (
              <label>
                动作
                <select
                  aria-label="导出动作"
                  value={clipId}
                  onChange={(event) => setClipId(event.target.value)}
                >
                  {project.clips.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label>
              背景
              <select
                aria-label="导出背景"
                value={options.background === null ? 'transparent' : 'solid'}
                onChange={(event) =>
                  setOptions({
                    ...options,
                    background: event.target.value === 'transparent' ? null : color,
                  })
                }
              >
                <option value="transparent">透明背景</option>
                <option value="solid">纯色背景</option>
              </select>
            </label>
            {options.background !== null && (
              <input
                type="color"
                aria-label="背景颜色"
                value={color}
                onChange={(event) => {
                  setColor(event.target.value);
                  setOptions({ ...options, background: event.target.value });
                }}
              />
            )}
            <label>
              <input
                type="checkbox"
                aria-label="导出假人"
                checked={options.mannequin}
                onChange={(event) => setOptions({ ...options, mannequin: event.target.checked })}
              />
              假人
            </label>
            <label>
              <input
                type="checkbox"
                aria-label="导出骨架线"
                checked={options.skeleton}
                onChange={(event) => setOptions({ ...options, skeleton: event.target.checked })}
              />
              骨架线
            </label>
          </fieldset>
          <p>
            {project.canvas.width} × {project.canvas.height} · {count} 张 · {project.fps} FPS
          </p>
          <p className="muted">
            {mode === 'pose'
              ? '预览即最终图片。'
              : '预览显示动作第一段。图包附带帧顺序与持续时间说明。'}
            <br />
            不包含墙地背景、网格、选择框、洋葱皮、操作手柄或参考图。画布缩放不影响导出。
          </p>
          <p role="alert">{problem}</p>
          {busy && (
            <div>
              <progress max={progress.total || 1} value={progress.done} />
              <p role="status">
                {progress.done === progress.total
                  ? '正在打包…'
                  : `正在绘制 ${progress.done} / ${progress.total}`}
              </p>
            </div>
          )}
          <p role="status">{message}</p>
          <div className="export-actions">
            <button
              className="accent"
              disabled={busy || !!problem || !!previewError || !preview}
              onClick={() => void generate()}
            >
              下载{mode === 'pose' ? ' PNG' : '图包'}
            </button>
            {busy && <button onClick={() => controller.current?.abort()}>取消导出</button>}
          </div>
        </div>
      </div>
    </dialog>
  );
}

export function ExportImages() {
  const { project, locked, clip } = usePoseEditor();
  const dragging = useUIStore((state) => state.previewPose !== null);
  const [snapshot, setSnapshot] = useState<Project | null>(null);
  return (
    <>
      <button
        className="accent"
        disabled={dragging || locked}
        onClick={() => {
          usePlaybackStore.getState().pause();
          setSnapshot(structuredClone(project));
        }}
      >
        导出图片 ↗
      </button>
      {snapshot && (
        <ExportDialog
          project={snapshot}
          initialClipId={clip?.id}
          onClose={() => setSnapshot(null)}
        />
      )}
    </>
  );
}
