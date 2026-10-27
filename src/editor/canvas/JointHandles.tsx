import { useEffect, useRef, useState } from 'react';
import { Circle, Group, Line } from 'react-konva';
import type Konva from 'konva';
import { dragBoneEndpoint } from '../../core/rig/dragPose';
import { forwardKinematics } from '../../core/rig/fk';
import type { PoseSnapshot, Vec2 } from '../../core/project/schema';
import { usePoseEditor } from '../state/usePoseEditor';
import { useUIStore } from '../state/uiStore';
import { boneColors } from '../../export/drawing';
import { screenToProject } from './coordinates';
import { poseDrawOrder } from '../../core/rig/bodyTurn';

export function JointHandles() {
  const { project, dispatch, locked } = usePoseEditor();
  const { previewPose, setPreview, viewport, selectBone, selectedBoneId } = useUIStore();
  const drag = useRef<{
    original: PoseSnapshot;
    node: Konva.Node;
    boneId: string;
    offset: Vec2;
    next: PoseSnapshot;
  } | null>(null);
  const grabOffset = useRef<Vec2>({ x: 0, y: 0 });
  const [feedback, setFeedback] = useState<{ target: Vec2; endpoint: Vec2; error: number } | null>(
    null,
  );
  const world = forwardKinematics(project.rig, previewPose ?? project.draft);

  useEffect(() => {
    const cancel = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !drag.current) return;
      const current = drag.current;
      drag.current = null;
      current.node.stopDrag();
      current.node.position(forwardKinematics(project.rig, current.original)[current.boneId].end);
      setPreview(null);
      setFeedback(null);
    };
    window.addEventListener('keydown', cancel);
    return () => window.removeEventListener('keydown', cancel);
  }, [project.rig, setPreview]);

  return (
    <Group>
      {poseDrawOrder(project.rig, previewPose ?? project.draft)
        .filter((id) => id !== selectedBoneId)
        .concat(selectedBoneId ? [selectedBoneId] : [])
        .map((id) => project.rig.bones.find((bone) => bone.id === id)!)
        .map((bone) => {
          const endpoint = world[bone.id].end;
          const chain = project.rig.ikChains.find((chain) => chain.lowerBoneId === bone.id);
          const ik = !!chain && (previewPose ?? project.draft).ikControls[chain.id].mode === 'ik';
          return (
            <Circle
              key={bone.id}
              x={endpoint.x}
              y={endpoint.y}
              radius={(ik ? 6 : 4) / viewport.scale}
              fill={selectedBoneId === bone.id ? '#f4bc6d' : '#1c212b'}
              stroke={boneColors[bone.side]}
              strokeWidth={1.5 / viewport.scale}
              hitStrokeWidth={8 / viewport.scale}
              draggable={!locked}
              onMouseEnter={(event) => {
                event.target.getStage()!.container().style.cursor = 'grab';
                event.target
                  .getStage()!
                  .container().title = `${bone.name} · ${ik ? 'IK 拖动' : 'FK 旋转'}`;
              }}
              onMouseLeave={(event) => {
                event.target.getStage()!.container().style.cursor = 'default';
                event.target.getStage()!.container().title = '';
              }}
              onClick={() => selectBone(bone.id)}
              onTap={() => selectBone(bone.id)}
              onMouseDown={(event) => {
                const pointer = screenToProject(
                  event.target.getStage()!.getPointerPosition()!,
                  viewport,
                );
                grabOffset.current = { x: endpoint.x - pointer.x, y: endpoint.y - pointer.y };
              }}
              onTouchStart={(event) => {
                const pointer = screenToProject(
                  event.target.getStage()!.getPointerPosition()!,
                  viewport,
                );
                grabOffset.current = { x: endpoint.x - pointer.x, y: endpoint.y - pointer.y };
              }}
              onDragStart={(event) => {
                const original = structuredClone(project.draft);
                // Capture the grab offset at pointer-down, before the drag threshold is crossed.
                drag.current = {
                  original,
                  next: original,
                  boneId: bone.id,
                  node: event.target,
                  offset: { ...grabOffset.current },
                };
                selectBone(bone.id);
                setPreview(original);
              }}
              onDragMove={(event) => {
                const current = drag.current;
                if (!current) return;
                const pointer = screenToProject(
                  event.target.getStage()!.getPointerPosition()!,
                  viewport,
                );
                const target = { x: pointer.x + current.offset.x, y: pointer.y + current.offset.y };
                const result = dragBoneEndpoint(project.rig, current.original, bone.id, target, {
                  mode: ik ? 'ik' : 'fk',
                });
                current.next = result.pose;
                event.target.position(result.endpoint);
                setPreview(result.pose);
                setFeedback(
                  result.ik && result.error > 0.5
                    ? { target, endpoint: result.endpoint, error: result.error }
                    : null,
                );
              }}
              onDragEnd={(event) => {
                const current = drag.current;
                drag.current = null;
                if (current) {
                  dispatch({
                    label: `拖动${bone.name}${ik ? ' IK' : ''}`,
                    apply: (draft) => {
                      draft.draft = current.next;
                    },
                  });
                  event.target.position(forwardKinematics(project.rig, current.next)[bone.id].end);
                }
                setPreview(null);
                setFeedback(null);
              }}
            />
          );
        })}
      {feedback && (
        <Group listening={false}>
          <Line
            points={[
              feedback.endpoint.x,
              feedback.endpoint.y,
              feedback.target.x,
              feedback.target.y,
            ]}
            stroke="#f4bc6d"
            dash={[6 / viewport.scale, 4 / viewport.scale]}
            strokeWidth={1 / viewport.scale}
          />
          <Circle
            x={feedback.target.x}
            y={feedback.target.y}
            radius={5 / viewport.scale}
            stroke="#f4bc6d"
            strokeWidth={1 / viewport.scale}
          />
        </Group>
      )}
    </Group>
  );
}
