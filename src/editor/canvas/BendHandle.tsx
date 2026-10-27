import { useEffect, useRef } from 'react';
import type Konva from 'konva';
import { Circle, Group, Line, Text } from 'react-konva';
import { usePoseEditor } from '../state/usePoseEditor';
import { useUIStore } from '../state/uiStore';
import { forwardKinematics } from '../../core/rig/fk';
import { dragBoneEndpoint } from '../../core/rig/dragPose';
import type { PoseSnapshot, Vec2 } from '../../core/project/schema';
import { screenToProject } from './coordinates';

export function BendHandle() {
  const { project, dispatch, locked } = usePoseEditor();
  const { selectedBoneId, previewPose, setPreview, viewport } = useUIStore();
  const drag = useRef<{
    original: PoseSnapshot;
    next: PoseSnapshot;
    node: Konva.Node;
    position: Vec2;
  } | null>(null);
  const chain = project.rig.ikChains.find(
    (item) => item.upperBoneId === selectedBoneId || item.lowerBoneId === selectedBoneId,
  );
  useEffect(() => {
    const cancel = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !drag.current) return;
      const current = drag.current;
      drag.current = null;
      current.node.stopDrag();
      current.node.position(current.position);
      setPreview(null);
    };
    window.addEventListener('keydown', cancel);
    return () => window.removeEventListener('keydown', cancel);
  }, [setPreview]);
  if (!chain) return null;
  const pose = previewPose ?? project.draft;
  const control = pose.ikControls[chain.id];
  if (control.mode !== 'ik') return null;
  const world = forwardKinematics(project.rig, pose);
  const start = world[chain.upperBoneId].start;
  const end = world[chain.lowerBoneId].end;
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const distance = Math.hypot(dx, dy);
  const direction = distance > 1e-6 ? Math.atan2(dy, dx) : world[chain.upperBoneId].angle;
  const middle = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
  const position = {
    x: middle.x - (Math.sin(direction) * control.bendSign * 65) / viewport.scale,
    y: middle.y + (Math.cos(direction) * control.bendSign * 65) / viewport.scale,
  };
  return (
    <Group>
      <Line
        points={[middle.x, middle.y, position.x, position.y]}
        stroke="#d8a565"
        dash={[4 / viewport.scale, 4 / viewport.scale]}
        strokeWidth={1 / viewport.scale}
        listening={false}
      />
      <Text
        x={position.x + 12 / viewport.scale}
        y={position.y - 6 / viewport.scale}
        text="弯曲方向"
        fontSize={11 / viewport.scale}
        fill="#d8a565"
        listening={false}
      />
      <Circle
        x={position.x}
        y={position.y}
        radius={7 / viewport.scale}
        stroke="#f4bc6d"
        fill="#2d2830"
        strokeWidth={2 / viewport.scale}
        draggable={!locked}
        onDragStart={(event) => {
          const original = structuredClone(project.draft);
          drag.current = { original, next: original, node: event.target, position };
          setPreview(original);
        }}
        onDragMove={(event) => {
          const current = drag.current;
          if (!current) return;
          const pointer = screenToProject(event.target.getStage()!.getPointerPosition()!, viewport);
          const originalWorld = forwardKinematics(project.rig, current.original);
          const root = originalWorld[chain.upperBoneId].start;
          const tip = originalWorld[chain.lowerBoneId].end;
          const cross =
            (tip.x - root.x) * (pointer.y - root.y) - (tip.y - root.y) * (pointer.x - root.x);
          if (Math.abs(cross) < 1e-6) return;
          const result = dragBoneEndpoint(
            project.rig,
            current.original,
            chain.lowerBoneId,
            current.original.ikControls[chain.id].target,
            { bendSign: cross > 0 ? 1 : -1 },
          );
          current.next = result.pose;
          setPreview(result.pose);
        }}
        onDragEnd={(event) => {
          const current = drag.current;
          drag.current = null;
          if (current) {
            dispatch({
              label: '调整弯曲方向',
              apply: (draft) => {
                draft.draft = current.next;
              },
            });
            // Reset the imperative Konva drag position; the final render places the handle.
            event.target.position(position);
          }
          setPreview(null);
        }}
      />
    </Group>
  );
}
