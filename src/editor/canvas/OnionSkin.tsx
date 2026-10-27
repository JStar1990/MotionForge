import { Group, Line } from 'react-konva';
import { describePose } from '../../export/drawing';
import { usePoseEditor } from '../state/usePoseEditor';
import { usePlaybackStore } from '../state/playbackStore';

export function OnionSkin() {
  const { project, clip, key } = usePoseEditor();
  const { onion, onionOpacity, playing } = usePlaybackStore();
  if (!onion || playing || !clip || !key) return null;
  const index = clip.keys.findIndex((item) => item.id === key.id);
  return (
    <Group listening={false} opacity={onionOpacity}>
      {[-1, 1].map((offset) => {
        const neighbor = clip.keys[index + offset];
        return (
          neighbor && (
            <Group key={offset}>
              {describePose(project.rig, neighbor.pose).map((segment) => (
                <Line
                  key={segment.id}
                  points={[segment.start.x, segment.start.y, segment.end.x, segment.end.y]}
                  stroke={offset < 0 ? '#6bbbf7' : '#f4bc6d'}
                  strokeWidth={10}
                  lineCap="round"
                />
              ))}
            </Group>
          )
        );
      })}
    </Group>
  );
}
