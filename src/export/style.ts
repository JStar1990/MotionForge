import type { PoseSnapshot } from '../core/project/schema';
import type { MannequinPart } from './mannequin';

export function mannequinFill(part: MannequinPart, pose: PoseSnapshot) {
  const near = pose.bodyTurn < 0 ? 'right' : 'left';
  const depth = Math.sin((Math.abs(pose.bodyTurn) * Math.PI) / 180);
  const far =
    '#' +
    [203, 209, 217]
      .map((value, index) =>
        Math.round(value + ([145, 155, 169][index] - value) * depth)
          .toString(16)
          .padStart(2, '0'),
      )
      .join('');
  return part.side === 'center' ? '#b8bec8' : part.side === near ? '#cbd1d9' : far;
}
