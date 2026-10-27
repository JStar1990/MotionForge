import { useRef, useState } from 'react';
import { loadPose, savePose } from '../../core/project/poseAssets';
import { describePose } from '../../export/drawing';
import { download, exportPose, importPose } from '../../persistence/files';
import { useProjectStore } from '../state/projectStore';
import { useUIStore } from '../state/uiStore';
import { usePoseEditor } from '../state/usePoseEditor';
import { usePlaybackStore } from '../state/playbackStore';
import { insertKey } from '../../core/animation/editing';
import type { PoseAsset, RigDefinition } from '../../core/project/schema';

function Thumbnail({ rig, asset }: { rig: RigDefinition; asset: PoseAsset }) {
  const segments = describePose(rig, asset.pose);
  const points = segments.flatMap((segment) => [segment.start, segment.end]);
  const minX = Math.min(...points.map((point) => point.x)) - 35;
  const minY = Math.min(...points.map((point) => point.y)) - 35;
  const width = Math.max(...points.map((point) => point.x)) - minX + 35;
  const height = Math.max(...points.map((point) => point.y)) - minY + 35;
  return (
    <svg
      viewBox={`${minX} ${minY} ${width} ${height}`}
      role="img"
      aria-label={`${asset.name}缩略图`}
    >
      {segments.map((segment) => (
        <line
          key={segment.id}
          x1={segment.start.x}
          y1={segment.start.y}
          x2={segment.end.x}
          y2={segment.end.y}
          stroke={segment.color}
          strokeWidth={10}
          strokeLinecap="round"
        />
      ))}
    </svg>
  );
}

export function PoseLibrary() {
  const {
    project,
    dispatch: dispatchPose,
    dispatchProject: dispatch,
    locked,
    clip,
    key,
  } = usePoseEditor();
  const dragging = useUIStore((state) => state.previewPose !== null);
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  function exportFile(id?: string) {
    download(
      new Blob([exportPose(project, id)], { type: 'application/json' }),
      `${project.poses.find((asset) => asset.id === id)?.name ?? '当前姿势'}.pose.json`,
    );
  }
  return (
    <div className="pose-library">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          dispatch(savePose(name || `姿势 ${project.poses.length + 1}`, project.draft));
          setName('');
        }}
      >
        <input
          aria-label="姿势名称"
          placeholder="输入姿势名称"
          value={name}
          maxLength={80}
          onChange={(event) => setName(event.target.value)}
        />
        <button disabled={locked || dragging} className="accent" type="submit">
          保存当前姿势
        </button>
      </form>
      <div className="pose-actions">
        <button disabled={locked || dragging || importing} onClick={() => input.current?.click()}>
          导入姿势 JSON
        </button>
        <button disabled={locked || dragging} onClick={() => exportFile()}>
          导出当前姿势
        </button>
      </div>
      <input
        ref={input}
        type="file"
        hidden
        accept=".json"
        aria-label="选择姿势文件"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (!file) return;
          const sourceProject = useProjectStore.getState().project;
          setImporting(true);
          try {
            if (file.size > 1024 * 1024) throw new Error('姿势文件超过 1 MB。');
            const text = await file.text();
            const current = useProjectStore.getState().project;
            if (current.id !== sourceProject.id) throw new Error('工程已经切换，请重新导入。');
            const asset = importPose(text, current);
            dispatch({
              label: '导入姿势',
              apply: (draft) => {
                draft.poses.push(asset);
              },
            });
            setMessage('姿势已加入姿势库');
          } catch {
            setMessage('导入失败：文件无效、版本不支持或骨架不兼容。当前工程未更改。');
          } finally {
            setImporting(false);
          }
        }}
      />
      {message && <p role="status">{message}</p>}
      {!project.poses.length && (
        <div className="empty-state">
          <strong>还没有姿势资产</strong>
          <p>保存当前姿势，之后可随时加载或导出。</p>
        </div>
      )}
      {project.poses.map((asset) => (
        <article className="pose-card" key={asset.id} aria-label={`姿势：${asset.name}`}>
          <Thumbnail rig={project.rig} asset={asset} />
          <input
            key={asset.name}
            aria-label={`重命名 ${asset.name}`}
            defaultValue={asset.name}
            maxLength={80}
            disabled={locked || dragging}
            onBlur={(event) => {
              const value = event.target.value.trim();
              if (!value) {
                event.target.value = asset.name;
                return;
              }
              dispatch({
                label: '重命名姿势',
                apply: (draft) => {
                  const target = draft.poses.find((item) => item.id === asset.id);
                  if (target) target.name = value;
                },
              });
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur();
            }}
          />
          <div className="pose-actions">
            <button disabled={locked || dragging} onClick={() => dispatchPose(loadPose(asset.id))}>
              加载
            </button>
            <button onClick={() => exportFile(asset.id)}>导出</button>
            <button
              disabled={
                dragging ||
                usePlaybackStore.getState().playing ||
                !clip ||
                clip.keys.length >= 300 ||
                clip.keys.reduce((sum, item) => sum + item.durationFrames, 0) >= 3000
              }
              onClick={() => clip && dispatch(insertKey(clip.id, asset.pose, asset.name, key?.id))}
            >
              加入动作
            </button>
            <button
              disabled={locked || dragging}
              onClick={() =>
                dispatch({
                  label: '删除姿势',
                  apply: (draft) => {
                    draft.poses = draft.poses.filter((item) => item.id !== asset.id);
                  },
                })
              }
            >
              删除
            </button>
          </div>
        </article>
      ))}
      <p className="muted">加载会替换当前草稿或整段关键姿势，可撤销；已保存资产保持独立。</p>
    </div>
  );
}
