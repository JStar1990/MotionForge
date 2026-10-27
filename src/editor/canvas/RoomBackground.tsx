import { Group, Line, Rect, Text } from 'react-konva';

export function RoomBackground({
  width,
  height,
  groundY,
  grid,
}: {
  width: number;
  height: number;
  groundY: number;
  grid: boolean;
}) {
  const seam = Math.max(0, groundY - height * 0.12);
  const vanishing = { x: width / 2, y: seam - height * 0.4 };
  return (
    <Group listening={false} clipX={0} clipY={0} clipWidth={width} clipHeight={height}>
      <Rect
        width={width}
        height={seam}
        fillLinearGradientStartPoint={{ x: 0, y: 0 }}
        fillLinearGradientEndPoint={{ x: 0, y: seam }}
        fillLinearGradientColorStops={[0, '#293340', 1, '#3c4858']}
      />
      <Rect
        y={seam}
        width={width}
        height={height - seam}
        fillLinearGradientStartPoint={{ x: 0, y: 0 }}
        fillLinearGradientEndPoint={{ x: 0, y: height - seam }}
        fillLinearGradientColorStops={[0, '#535b66', 1, '#303842']}
      />
      {grid && (
        <>
          {Array.from({ length: 7 }, (_, i) => (
            <Line
              key={`wall${i}`}
              points={[((i + 1) * width) / 8, 0, ((i + 1) * width) / 8, seam]}
              stroke="#495565"
              opacity={0.45}
              strokeWidth={1}
            />
          ))}
          {Array.from({ length: 13 }, (_, i) => {
            const bottomX = ((i - 2) * width) / 8;
            const ratio = (seam - vanishing.y) / (height - vanishing.y);
            const topX = vanishing.x + (bottomX - vanishing.x) * ratio;
            return (
              <Line
                key={`floor${i}`}
                points={[topX, seam, bottomX, height]}
                stroke="#78818b"
                opacity={0.4}
                strokeWidth={1}
              />
            );
          })}
          {[0.12, 0.29, 0.52, 0.82].map((t) => (
            <Line
              key={t}
              points={[0, seam + (height - seam) * t, width, seam + (height - seam) * t]}
              stroke="#78818b"
              opacity={0.4}
              strokeWidth={1}
            />
          ))}
        </>
      )}
      <Line points={[0, seam, width, seam]} stroke="#87909b" strokeWidth={3} />
      <Line
        points={[0, seam + 7, width, seam + 7]}
        stroke="#1c242e"
        opacity={0.45}
        strokeWidth={5}
      />
      <Line
        points={[0, groundY, width, groundY]}
        stroke="#c4b694"
        opacity={0.65}
        dash={[9, 7]}
        strokeWidth={1.5}
      />
      <Text
        x={18}
        y={Math.min(height - 25, groundY + 9)}
        text="地面接触参考"
        fontSize={14}
        fill="#c4b694"
      />
      <Text x={18} y={Math.max(12, seam - 30)} text="墙面" fontSize={14} fill="#a8b2c0" />
    </Group>
  );
}
