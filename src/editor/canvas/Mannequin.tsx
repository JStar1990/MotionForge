import { Ellipse, Group, Line } from 'react-konva';
import { describeMannequin } from '../../export/mannequin';
import { usePoseEditor } from '../state/usePoseEditor';
import { useUIStore } from '../state/uiStore';

export function Mannequin() {
  const { project } = usePoseEditor();
  const { previewPose, selectBone } = useUIStore();
  const pose = previewPose ?? project.draft;
  const near = pose.bodyTurn < 0 ? 'right' : 'left';
  const depth = Math.sin((Math.abs(pose.bodyTurn) * Math.PI) / 180);
  const farFill =
    '#' +
    [203, 209, 217]
      .map((value, index) =>
        Math.round(value + ([145, 155, 169][index] - value) * depth)
          .toString(16)
          .padStart(2, '0'),
      )
      .join('');
  return (
    <Group>
      {describeMannequin(project.rig, pose).map((part, index) => {
        const fill = part.side === 'center' ? '#b8bec8' : part.side === near ? '#cbd1d9' : farFill;
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
