import { expect, it } from 'vitest';
import { createDefaultProject } from '../core/project/defaultProject';
import { forwardKinematics } from '../core/rig/fk';
import { describeMannequin } from './mannequin';

it.each([-30, 0, 30])('正面附近 %s° 时前臂与手默认位于两条腿前方', (turn) => {
  const project = createDefaultProject();
  project.draft.bodyTurn = turn;
  project.draft.localRotations.leftThigh = -Math.PI / 3;
  project.draft.localRotations.rightThigh = Math.PI / 3;
  const parts = describeMannequin(project.rig, project.draft);
  const legs = parts.flatMap((part, i) => (/Thigh|Shin|Foot/.test(part.boneId) ? [i] : []));
  for (const side of ['left', 'right']) {
    const arms = parts.flatMap((part, i) =>
      part.boneId === `${side}Forearm` || part.boneId === `${side}Hand` ? [i] : [],
    );
    expect(Math.min(...arms)).toBeGreaterThan(Math.max(...legs));
  }
});

it.each([-90, -60, -45, 45, 60, 90])('侧身 %s° 远侧整臂在躯干后，近侧整臂在腿前', (turn) => {
  const project = createDefaultProject();
  project.draft.bodyTurn = turn;
  project.draft.rootRotation = 0.6;
  const parts = describeMannequin(project.rig, project.draft);
  const near = turn < 0 ? 'right' : 'left';
  const far = near === 'left' ? 'right' : 'left';
  const indices = (filter: (id: string) => boolean) =>
    parts.flatMap((part, index) => (filter(part.boneId) ? [index] : []));
  const farArm = indices((id) => id.startsWith(far) && /UpperArm|Forearm|Hand/.test(id));
  const nearArm = indices((id) => id.startsWith(near) && /UpperArm|Forearm|Hand/.test(id));
  const body = indices((id) => id === 'torso');
  const legs = indices((id) => /Thigh|Shin|Foot/.test(id));
  expect(Math.max(...farArm)).toBeLessThan(Math.min(...body));
  expect(Math.min(...nearArm)).toBeGreaterThan(Math.max(...legs));
  expect(Math.max(...farArm)).toBeLessThan(Math.min(...nearArm));
});

it.each([-90, -30, 0, 30, 90])('转身 %s° 时肩髋遮挡符合正面/侧面的朝向', (turn) => {
  const project = createDefaultProject();
  project.draft.bodyTurn = turn;
  const parts = describeMannequin(project.rig, project.draft);
  const bodyIndices = parts.flatMap((part, i) => (part.boneId === 'torso' ? [i] : []));
  const near = turn < 0 ? 'right' : 'left';
  const far = near === 'right' ? 'left' : 'right';
  const nearIndex = parts.findIndex((part) => part.boneId === `${near}Thigh`);
  const farEnd = parts.reduce(
    (last, part, index) =>
      part.boneId.startsWith(far) && /Thigh|Shin|Foot/.test(part.boneId) ? index : last,
    -1,
  );
  expect(nearIndex).toBeGreaterThan(farEnd);
  for (const suffix of ['UpperArm', 'Thigh']) {
    const nearSocket = parts.findIndex(
      (part) => part.boneId === `${near}${suffix}` && part.ellipse,
    );
    const farSocket = parts.findIndex((part) => part.boneId === `${far}${suffix}` && part.ellipse);
    expect(nearSocket).toBeGreaterThan(Math.max(...bodyIndices));
    if (Math.abs(turn) < 45) expect(farSocket).toBeGreaterThan(Math.max(...bodyIndices));
    else expect(farSocket).toBeLessThan(Math.min(...bodyIndices));
  }
});

it.each([-90, 0, 90])('转身 %s° 抬肩后连接形状仍从胸腔延伸到臂根', (turn) => {
  const project = createDefaultProject();
  project.draft.bodyTurn = turn;
  project.draft.localRotations.leftShoulder = -Math.PI / 3;
  project.draft.localRotations.rightShoulder = Math.PI / 3;
  const world = forwardKinematics(project.rig, project.draft);
  const parts = describeMannequin(project.rig, project.draft);
  for (const side of ['left', 'right']) {
    const id = `${side}Shoulder`;
    const points = parts.find((part) => part.boneId === id)!.points!;
    const local = Array.from({ length: points.length / 2 }, (_, i) => {
      const x = points[2 * i] - world[id].start.x;
      const y = points[2 * i + 1] - world[id].start.y;
      return x * Math.cos(world[id].angle) + y * Math.sin(world[id].angle);
    });
    const length = Math.hypot(
      world[id].end.x - world[id].start.x,
      world[id].end.y - world[id].start.y,
    );
    expect(Math.min(...local)).toBeLessThan(0);
    expect(Math.max(...local)).toBeGreaterThan(length);
    expect(world[`${side}UpperArm`].start.x).toBeCloseTo(world[id].end.x);
    expect(world[`${side}UpperArm`].start.y).toBeCloseTo(world[id].end.y);
  }
});

it('假人描述随根节点平移，生成过程中不修改姿势', () => {
  const project = createDefaultProject();
  const before = structuredClone(project);
  const original = describeMannequin(project.rig, project.draft);
  expect(project).toEqual(before);
  project.draft.rootPosition.x += 50;
  project.draft.rootPosition.y -= 30;
  const moved = describeMannequin(project.rig, project.draft);
  for (let i = 0; i < original.length; i++) {
    if (original[i].points)
      original[i].points!.forEach((value, j) =>
        expect(moved[i].points![j]).toBeCloseTo(value + (j % 2 === 0 ? 50 : -30)),
      );
    if (original[i].ellipse) {
      expect(moved[i].ellipse!.center.x).toBeCloseTo(original[i].ellipse!.center.x + 50);
      expect(moved[i].ellipse!.center.y).toBeCloseTo(original[i].ellipse!.center.y - 30);
    }
  }
});
