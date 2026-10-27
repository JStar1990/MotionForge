import { Ellipse, Group, Line } from 'react-konva';
import { describeMannequin } from '../../export/mannequin';
import { mannequinFill } from '../../export/style';
import { usePoseEditor } from '../state/usePoseEditor';
import { useUIStore } from '../state/uiStore';

export function Mannequin() {
  const { project } = usePoseEditor();
  const { previewPose, selectBone } = useUIStore();
  const pose = previewPose ?? project.draft;
  return (
    <Group>
      {describeMannequin(project.rig, pose).map((part, index) => {
        const fill = mannequinFill(part, pose);
        return (
          <Group
            key={`${part.boneId}-${index}`}
            onClick={() => selectBone(part.boneId)}
            onTap={() => selectBone(part.boneId)}
          >
            {part.points && (
              <Line
                points={part.points}
                closed
                tension={0.12}
                fill={fill}
                stroke="#525e70"
                strokeWidth={2}
                lineJoin="round"
              />
            )}
            {part.ellipse && (
              <Ellipse
                x={part.ellipse.center.x}
                y={part.ellipse.center.y}
                radiusX={part.ellipse.radiusX}
                radiusY={part.ellipse.radiusY}
                rotation={part.ellipse.rotation}
                fill={fill}
                stroke="#525e70"
                strokeWidth={2}
              />
            )}
            {part.guide && (
              <Line points={part.guide} stroke="#697589" strokeWidth={1.5} listening={false} />
            )}
          </Group>
        );
      })}
    </Group>
  );
}
