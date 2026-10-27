import type { BoneDefinition, Vec2 } from '../project/schema';

const TAU = Math.PI * 2;
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

function bounds(bone: BoneDefinition, previous: number): [number, number] {
  const min = bone.angleLimit?.min ?? previous - Math.PI;
  const max = bone.angleLimit?.max ?? previous + Math.PI;
  if (max - min <= TAU) return [min, max];
  const start = clamp(previous - Math.PI, min, max - TAU);
  return [start, start + TAU];
}

/** Minimize endpoint error inside joint limits, retaining the requested bend side when feasible.
 * For each upper angle the best lower angle is analytic; only one bounded dimension is searched.
 */
export function solveConstrainedChain(
  upper: BoneDefinition,
  lower: BoneDefinition,
  parentAngle: number,
  start: Vec2,
  target: Vec2,
  previousUpper: number,
  previousLower: number,
  bendSign: 1 | -1,
) {
  const [uMin, uMax] = bounds(upper, previousUpper);
  const [lMin, lMax] = bounds(lower, previousLower);
  const intervals: [number, number][] = [];
  const first = Math.floor((lMin + lower.restAngle) / Math.PI) - 1;
  const last = Math.ceil((lMax + lower.restAngle) / Math.PI) + 1;
  for (let k = first; k <= last; k++) {
    const mid = (k + 0.5) * Math.PI;
    if (Math.sin(mid) * bendSign > 0) continue;
    const min = Math.max(lMin, k * Math.PI - lower.restAngle);
    const max = Math.min(lMax, (k + 1) * Math.PI - lower.restAngle);
    if (min <= max) intervals.push([min, max]);
  }
  // Some imported limits forbid the selected side. Still return a valid bounded pose.
  if (!intervals.length) intervals.push([lMin, lMax]);
  const evaluate = (u: number) => {
    const a = parentAngle + upper.restAngle + u;
    const elbow = {
      x: start.x + upper.length * Math.cos(a),
      y: start.y + upper.length * Math.sin(a),
    };
    const direction = Math.atan2(target.y - elbow.y, target.x - elbow.x) - a - lower.restAngle;
    let best = { u, l: previousLower, cost: Infinity, continuity: Infinity };
    for (const [min, max] of intervals) {
      const turn = Math.round(((min + max) / 2 - direction) / TAU);
      for (const shift of [-1, 0, 1]) {
        const l = clamp(direction + (turn + shift) * TAU, min, max);
        const angle = a + lower.restAngle + l;
        const cost =
          (elbow.x + lower.length * Math.cos(angle) - target.x) ** 2 +
          (elbow.y + lower.length * Math.sin(angle) - target.y) ** 2;
        const continuity = (u - previousUpper) ** 2 + (l - previousLower) ** 2;
        if (
          cost < best.cost - 1e-8 ||
          (Math.abs(cost - best.cost) <= 1e-8 && continuity < best.continuity)
        )
          best = { u, l, cost, continuity };
      }
    }
    return best;
  };
  const samples = Array.from({ length: 97 }, (_, i) => evaluate(uMin + ((uMax - uMin) * i) / 96));
  const candidates = [...samples, evaluate(clamp(previousUpper, uMin, uMax))];
  for (let i = 1; i < 96; i++) {
    if (samples[i].cost > samples[i - 1].cost || samples[i].cost > samples[i + 1].cost) continue;
    if (samples[i].cost === samples[i - 1].cost && samples[i].cost === samples[i + 1].cost)
      continue;
    let left = samples[i - 1].u;
    let right = samples[i + 1].u;
    for (let j = 0; j < 32; j++) {
      const a = left + (right - left) * 0.381966;
      const b = left + (right - left) * 0.618034;
      if (evaluate(a).cost <= evaluate(b).cost) right = b;
      else left = a;
    }
    candidates.push(evaluate((left + right) / 2));
  }
  candidates.sort((a, b) =>
    Math.abs(a.cost - b.cost) > 1e-8 ? a.cost - b.cost : a.continuity - b.continuity,
  );
  return { upperRotation: candidates[0].u, lowerRotation: candidates[0].l };
}
