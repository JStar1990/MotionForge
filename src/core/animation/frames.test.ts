import { expect, it } from 'vitest';
import { keyIntervals, sampleFrame } from './frames';
import { exposureFixture } from '../../test/fixtures';

it('A×3/B×2/C×4 是 9 帧，保持式采样和边界正确', () => {
  const clip = exposureFixture();
  expect(keyIntervals(clip).map(({ start, end }) => [start, end])).toEqual([
    [0, 3],
    [3, 5],
    [5, 9],
  ]);
  expect(Array.from({ length: 9 }, (_, frame) => sampleFrame(clip, frame)?.name)).toEqual([
    'A',
    'A',
    'A',
    'B',
    'B',
    'C',
    'C',
    'C',
    'C',
  ]);
  expect(9 / 12).toBe(0.75);
  expect(9 / 24).toBe(0.375);
  for (const frame of [-1, 9, 1.5, NaN]) expect(sampleFrame(clip, frame)).toBeNull();
  expect(sampleFrame({ ...clip, keys: [] }, 0)).toBeNull();
});
