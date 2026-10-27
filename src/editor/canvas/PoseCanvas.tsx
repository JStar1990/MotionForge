import { useEffect, useRef, useState } from 'react';
import { Circle, Group, Layer, Line, Rect, Stage } from 'react-konva';
import { describePose } from '../../export/drawing';
import { usePoseEditor } from '../state/usePoseEditor';
import { useUIStore } from '../state/uiStore';
import { syncFKControls } from '../state/poseEdits';
import type { PoseSnapshot } from '../../core/project/schema';
import { JointHandles } from './JointHandles';
import { BendHandle } from './BendHandle';
import { Mannequin } from './Mannequin';
import { RoomBackground } from './RoomBackground';
import { OnionSkin } from './OnionSkin';

export function PoseCanvas() {
  const container = useRef<HTMLDivElement>(null);
  const dragStart = useRef<PoseSnapshot | null>(null);
  const pan = useRef<{ pointerId: number; x: number; y: number; viewport: typeof viewport } | null>(
    null,
  );
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [size, setSize] = useState({ width: 600, height: 600 });
  const { project, dispatch, locked, clip, key } = usePoseEditor();
  const {
    viewport,
    setViewport,
    previewPose,
    setPreview,
    selectedBoneId,
    selectBone,
    showGrid,
    toggleGrid,
    showMannequin,
    showSkeleton,
    toggleMannequin,
    toggleSkeleton,
    showRoom,
    groundY,
    toggleRoom,
    setGroundY,
  } = useUIStore();
  const pose = previewPose ?? project.draft;
  const segments = describePose(project.rig, pose);
  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (
        event.target instanceof HTMLElement &&
        event.target.closest('input, textarea, select, [contenteditable="true"]')
      )
        return;
      if (event.code === 'Space' && !useUIStore.getState().previewPose) {
        event.preventDefault();
        setSpaceHeld(true);
      }
    };
    const up = (event: KeyboardEvent) => {
      if (event.code === 'Space') setSpaceHeld(false);
    };
    const blur = () => {
      setSpaceHeld(false);
      pan.current = null;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, []);
  const fit = () => {
    const scale = Math.min(
      (size.width - 80) / project.canvas.width,
      (size.height - 80) / project.canvas.height,
    );
    setViewport({
      scale,
      x: (size.width - project.canvas.width * scale) / 2,
      y: (size.height - project.canvas.height * scale) / 2,
    });
  };
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ width, height });
      const scale = Math.min(
        (width - 80) / project.canvas.width,
        (height - 80) / project.canvas.height,
      );
      setViewport({
        scale,
        x: (width - project.canvas.width * scale) / 2,
        y: (height - project.canvas.height * scale) / 2,
      });
    });
    if (container.current) observer.observe(container.current);
    return () => observer.disconnect();
  }, [project.canvas.width, project.canvas.height, setViewport]);

  useEffect(() => {
    const cancel = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && dragStart.current) {
        dragStart.current = null;
        setPreview(null);
      }
    };
    window.addEventListener('keydown', cancel);
    return () => window.removeEventListener('keydown', cancel);
  }, [setPreview]);

  return (
    <section className="canvas-panel">
      <div className="canvas-heading">
        <span>
          <i className="status-dot" />
          {clip ? `${clip.name} / ${key?.name ?? '空动作'}` : '独立姿势草稿'}
        </span>
        <span className="muted">
          {pose.bodyTurn === 0 ? '正面' : pose.bodyTurn > 0 ? '朝右侧身' : '朝左侧身'} ·{' '}
          {Math.abs(pose.bodyTurn)}° · 项目坐标
        </span>
      </div>
      <div
        ref={container}
        className="canvas-host"
        data-testid="pose-canvas"
        style={{ cursor: spaceHeld ? 'grab' : undefined }}
        onPointerDownCapture={(event) => {
          if (previewPose || !(event.button === 1 || (spaceHeld && event.button === 0))) return;
          event.preventDefault();
          event.stopPropagation();
          pan.current = {
            pointerId: event.pointerId,
            x: event.clientX,
            y: event.clientY,
            viewport: { ...viewport },
          };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMoveCapture={(event) => {
          const current = pan.current;
          if (!current || current.pointerId !== event.pointerId) return;
          event.preventDefault();
          event.stopPropagation();
          setViewport({
            ...current.viewport,
            x: current.viewport.x + event.clientX - current.x,
            y: current.viewport.y + event.clientY - current.y,
          });
        }}
        onPointerUpCapture={(event) => {
          if (!pan.current) return;
          event.preventDefault();
          event.stopPropagation();
          pan.current = null;
          event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        onPointerCancel={() => {
          pan.current = null;
        }}
      >
        <Stage
          width={size.width}
          height={size.height}
          onWheel={(event) => {
            event.evt.preventDefault();
            const pointer = event.target.getStage()?.getPointerPosition();
            if (!pointer || previewPose || pan.current) return;
            const scale = Math.max(
              0.1,
              Math.min(3, viewport.scale * (event.evt.deltaY > 0 ? 0.9 : 1.1)),
            );
            setViewport({
              scale,
              x: pointer.x - ((pointer.x - viewport.x) * scale) / viewport.scale,
              y: pointer.y - ((pointer.y - viewport.y) * scale) / viewport.scale,
            });
          }}
        >
          <Layer>
            <Group x={viewport.x} y={viewport.y} scaleX={viewport.scale} scaleY={viewport.scale}>
              <Rect
                width={project.canvas.width}
                height={project.canvas.height}
                fill="#1c212b"
                stroke="#3a4352"
                strokeWidth={1 / viewport.scale}
                onClick={() => selectBone(null)}
              />
              {showRoom && (
                <RoomBackground
                  width={project.canvas.width}
                  height={project.canvas.height}
                  groundY={Math.max(0, Math.min(project.canvas.height, groundY))}
                  grid={showGrid}
                />
              )}
              {showGrid && !showRoom && (
                <Group listening={false}>
                  {Array.from({ length: Math.ceil(project.canvas.width / 64) - 1 }, (_, i) => (
                    <Line
                      key={`x${i}`}
                      points={[(i + 1) * 64, 0, (i + 1) * 64, project.canvas.height]}
                      stroke="#252c38"
                      strokeWidth={1 / viewport.scale}
                    />
                  ))}
                  {Array.from({ length: Math.ceil(project.canvas.height / 64) - 1 }, (_, i) => (
                    <Line
                      key={`y${i}`}
                      points={[0, (i + 1) * 64, project.canvas.width, (i + 1) * 64]}
                      stroke="#252c38"
                      strokeWidth={1 / viewport.scale}
                    />
                  ))}
                  <Line
                    points={[0, 800, project.canvas.width, 800]}
                    stroke="#485365"
                    dash={[8, 8]}
                    strokeWidth={1 / viewport.scale}
                  />
                </Group>
              )}
              <OnionSkin />
              {showMannequin && <Mannequin />}
              {showSkeleton &&
                segments.map((segment) => (
                  <Group
                    key={segment.id}
                    onClick={() => selectBone(segment.id)}
                    onTap={() => selectBone(segment.id)}
                    onMouseEnter={(event) => {
                      event.target.getStage()!.container().title = project.rig.bones.find(
                        (bone) => bone.id === segment.id,
                      )!.name;
                    }}
                    onMouseLeave={(event) => {
                      event.target.getStage()!.container().title = '';
                    }}
                  >
                    {selectedBoneId === segment.id && (
                      <Line
                        points={[segment.start.x, segment.start.y, segment.end.x, segment.end.y]}
                        stroke="#f4bc6d"
                        strokeWidth={19}
                        lineCap="round"
                        opacity={0.28}
                      />
                    )}
                    <Line
                      points={[segment.start.x, segment.start.y, segment.end.x, segment.end.y]}
                      stroke={segment.color}
                      strokeWidth={showMannequin ? 3 : 7}
                      lineCap="round"
                      hitStrokeWidth={26}
                    />
                    <Circle
                      x={segment.start.x}
                      y={segment.start.y}
                      radius={showMannequin ? 3 : 6}
                      fill="#1c212b"
                      stroke={segment.color}
                      strokeWidth={3}
                    />
                    <Circle x={segment.end.x} y={segment.end.y} radius={4} fill={segment.color} />
                    {segment.profile && (
                      <Line
                        points={segment.profile}
                        stroke={segment.color}
                        strokeWidth={3}
                        lineJoin="round"
                        listening={false}
                      />
                    )}
                  </Group>
                ))}
              <JointHandles />
              <BendHandle />
              <Circle
                x={pose.rootPosition.x}
                y={pose.rootPosition.y}
                radius={12}
                fill="#f4bc6d"
                stroke="#1c212b"
                strokeWidth={4}
                draggable={!locked}
                onClick={() => selectBone(null)}
                onTap={() => selectBone(null)}
                onDragStart={() => {
                  dragStart.current = structuredClone(project.draft);
                  selectBone(null);
                }}
                onDragMove={(event) => {
                  if (!dragStart.current) {
                    event.target.stopDrag();
                    event.target.position(project.draft.rootPosition);
                    return;
                  }
                  const next = structuredClone(dragStart.current);
                  next.rootPosition = event.target.position();
                  syncFKControls(project, next);
                  setPreview(next);
                }}
                onDragEnd={(event) => {
                  if (dragStart.current) {
                    const next = structuredClone(dragStart.current);
                    next.rootPosition = event.target.position();
                    syncFKControls(project, next);
                    dispatch({
                      label: '移动根节点',
                      apply: (draft) => {
                        draft.draft = next;
                      },
                    });
                  }
                  dragStart.current = null;
                  setPreview(null);
                }}
              />
            </Group>
          </Layer>
        </Stage>
        <div className="canvas-legend">
          <span className="left-dot">角色左侧</span>
          <span className="right-dot">角色右侧</span>
          <span>● 根节点</span>
        </div>
        <div className="viewport-tools">
          <button onClick={toggleRoom} aria-pressed={showRoom}>
            墙地背景
          </button>
          <button onClick={toggleMannequin} aria-pressed={showMannequin}>
            假人
          </button>
          <button onClick={toggleSkeleton} aria-pressed={showSkeleton}>
            骨架线
          </button>
          <button onClick={toggleGrid} aria-pressed={showGrid}>
            网格
          </button>
          <span>{Math.round(viewport.scale * 100)}%</span>
          <button onClick={fit} disabled={locked || previewPose !== null}>
            适配画布
          </button>
        </div>
        {showRoom && (
          <label className="ground-control">
            地面位置
            <input
              aria-label="地面位置"
              type="number"
              min={0}
              max={project.canvas.height}
              step={10}
              value={groundY}
              onChange={(event) => {
                if (event.target.value === '') return;
                const value = Number(event.target.value);
                if (Number.isFinite(value) && value >= 0 && value <= project.canvas.height)
                  setGroundY(value);
              }}
            />
            <span>px</span>
            <button onClick={() => setGroundY(820)}>复位</button>
          </label>
        )}
      </div>
      <div className="canvas-footer">
        <span>拖动关节点摆姿势 · 空格/中键拖动画布 · 滚轮缩放 · Esc 取消</span>
        <span>
          {project.canvas.width} × {project.canvas.height}
        </span>
      </div>
    </section>
  );
}
