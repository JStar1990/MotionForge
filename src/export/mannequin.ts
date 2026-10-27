import type { PoseSnapshot, RigDefinition, Vec2 } from '../core/project/schema';
import { forwardKinematics, rotate } from '../core/rig/fk';

export type MannequinPart = {
  boneId: string;
  side: 'left' | 'right' | 'center';
  points?: number[];
  ellipse?: { center: Vec2; radiusX: number; radiusY: number; rotation: number };
  guide?: number[];
};

/** Rigid, bone-bound drawing primitives in project coordinates. No viewport or mesh state. */
export function describeMannequin(rig: RigDefinition, pose: PoseSnapshot): MannequinPart[] {
  if (rig.id !== 'human-2d-v1') return [];
  const world = forwardKinematics(rig, pose);
  const bones = new Map(rig.bones.map((bone) => [bone.id, bone]));
  const parts: MannequinPart[] = [];
  function point(id: string, x: number, y: number): Vec2 {
    const rotated = rotate({ x, y }, world[id].angle);
    return { x: world[id].start.x + rotated.x, y: world[id].start.y + rotated.y };
  }
  function polygon(id: string, coordinates: [number, number][], guide?: [number, number][]) {
    parts.push({
      boneId: id,
      side: bones.get(id)!.side,
      points: coordinates.flatMap(([x, y]) => {
        const p = point(id, x, y);
        return [p.x, p.y];
      }),
      guide: guide?.flatMap(([x, y]) => {
        const p = point(id, x, y);
        return [p.x, p.y];
      }),
    });
  }
  function ellipse(id: string, x: number, y: number, along: number, across: number) {
    parts.push({
      boneId: id,
      side: bones.get(id)!.side,
      ellipse: {
        center: point(id, x, y),
        radiusX: along,
        radiusY: across,
        rotation: (world[id].angle * 180) / Math.PI,
      },
    });
  }
  const width = Math.sqrt(
    Math.cos((pose.bodyTurn * Math.PI) / 180) ** 2 +
      0.24 * Math.sin((pose.bodyTurn * Math.PI) / 180) ** 2,
  );
  // The torso retains depth in profile while its shoulder/hip attachment span contracts.
  polygon(
    'torso',
    [
      [48, -34 * width],
      [98, -48 * width],
      [162, -66 * width],
      [181, -43 * width],
      [181, 43 * width],
      [162, 66 * width],
      [98, 48 * width],
      [48, 34 * width],
    ],
    [
      [48, 0],
      [165, 0],
    ],
  );
  polygon(
    'torso',
    [
      [-34, -47 * width],
      [-39, 0],
      [-34, 47 * width],
      [5, 55 * width],
      [45, 34 * width],
      [45, -34 * width],
      [5, -55 * width],
    ],
    [
      [-34, 0],
      [15, 0],
      [45, 0],
    ],
  );
  const neckLength = bones.get('neck')!.length;
  polygon('neck', [
    [0, -13],
    [neckLength, -11],
    [neckLength, 11],
    [0, 13],
  ]);
  const headLength = bones.get('head')!.length;
  ellipse('head', headLength * 0.52, 0, headLength * 0.62, headLength * 0.43);
  const faceShift = (17 * pose.bodyTurn) / 90;
  const headGuide = [
    [headLength * 0.12, faceShift],
    [headLength * 0.9, faceShift],
  ] as [number, number][];
  const head = parts.at(-1)!;
  head.guide = headGuide.flatMap(([x, y]) => {
    const p = point('head', x, y);
    return [p.x, p.y];
  });

  for (const side of ['left', 'right'] as const) {
    // Shoulder rotation moves the arm socket away from the fixed chest outline.
    // Bind a collar/deltoid bridge to that connecting bone, including in profile.
    const shoulder = `${side}Shoulder`;
    const socket = world[shoulder];
    const shoulderLength = Math.hypot(socket.end.x - socket.start.x, socket.end.y - socket.start.y);
    polygon(shoulder, [
      [-4, -12],
      [shoulderLength, -16],
      [shoulderLength + 5, 0],
      [shoulderLength, 16],
      [-4, 12],
    ]);
    for (const [suffix, top, bottom] of [
      ['UpperArm', 18, 12],
      ['Forearm', 13, 7],
      ['Thigh', 27, 15],
      ['Shin', 19, 9],
    ] as const) {
      const id = `${side}${suffix}`;
      const length = bones.get(id)!.length;
      polygon(id, [
        [0, -top * 0.7],
        [length * 0.2, -top],
        [length * 0.8, -bottom * 1.15],
        [length, -bottom],
        [length, bottom],
        [length * 0.8, bottom * 1.15],
        [length * 0.2, top],
        [0, top * 0.7],
      ]);
      ellipse(id, 0, 0, top * 0.76, top * 0.76);
      ellipse(id, length, 0, bottom, bottom);
    }
    const hand = `${side}Hand`;
    const handLength = bones.get(hand)!.length;
    polygon(hand, [
      [0, -7],
      [handLength * 0.55, -12],
      [handLength, -9],
      [handLength, 7],
      [handLength * 0.5, 12],
      [0, 7],
    ]);
    const foot = `${side}Foot`;
    const footLength = bones.get(foot)!.length;
    polygon(foot, [
      [-9, -10],
      [footLength * 0.4, -8],
      [footLength, -3],
      [footLength, 11],
      [-9, 13],
    ]);
  }
  const near = pose.bodyTurn < 0 ? 'right' : 'left';
  const frontal = Math.abs(pose.bodyTurn) < 45;
  const rank = (part: MannequinPart) => {
    // Collar bridges start beneath the chest, but the arm/hip sockets are on
    // the front surface. A front-facing torso must not cover either socket.
    if (part.boneId.endsWith('Shoulder')) return 0;
    const sideOrder = part.side === near ? 1 : 0;
    if (frontal) {
      // In front view hands may overlap either leg, but this override must not
      // pull the far arm through the torso when the character turns sideways.
      if (part.boneId.endsWith('Forearm')) return 8 + sideOrder;
      if (part.boneId.endsWith('Hand')) return 10 + sideOrder;
      if (part.side === 'center') return 1;
      return part.boneId.endsWith('UpperArm') ? 4 + sideOrder : 2 + sideOrder;
    }
    // In profile only the far limbs pass behind the body; the near hip and
    // shoulder remain visible on top. Apply the same rule to arms and legs.
    if (part.side === 'center') return 2;
    if (part.side !== near) return 1;
    if (part.boneId.endsWith('UpperArm')) return 4;
    if (part.boneId.endsWith('Forearm')) return 5;
    if (part.boneId.endsWith('Hand')) return 6;
    return 3;
  };
  return parts.sort((a, b) => rank(a) - rank(b));
}
