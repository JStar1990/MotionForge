import { expect, it } from 'vitest';
import { createDefaultProject } from '../project/defaultProject';
import { forwardKinematics } from './fk';
import { rigForPose, poseDrawOrder } from './bodyTurn';
import { dragBoneEndpoint } from './dragPose';
import { parseProject } from '../project/schema';
import { execute, undo } from '../commands/history';
import { syncControls } from './controls';

it.each([-90, -45, 45, 90])('转身 %s° 收窄肩髋，保留真实四肢长度和基础骨架', (turn) => {
  const project = createDefaultProject();
  const before = structuredClone(project);
  project.draft.bodyTurn = turn;
  const world = forwardKinematics(project.rig, project.draft);
  const factor = Math.max(0.08, Math.cos((Math.abs(turn) * Math.PI) / 180));
  expect(Math.abs(world.leftUpperArm.start.x - world.rightUpperArm.start.x)).toBeCloseTo(
    132 * factor,
  );
  expect(Math.abs(world.leftThigh.start.x - world.rightThigh.start.x)).toBeCloseTo(80 * factor);
  for (const chain of project.rig.ikChains)
    for (const id of [chain.upperBoneId, chain.lowerBoneId]) {
      const segment = world[id];
      expect(
        Math.hypot(segment.end.x - segment.start.x, segment.end.y - segment.start.y),
      ).toBeCloseTo(project.rig.bones.find((bone) => bone.id === id)!.length);
    }
  expect(project.rig).toEqual(before.rig);
  expect(project.draft.localRotations).toEqual(before.draft.localRotations);
});

it.each([-90, 90])('侧身 %s° 的 IK/FK 仍采用正确父空间', (turn) => {
  const project = createDefaultProject();
  project.draft.bodyTurn = turn;
  project.draft.rootRotation = 0.35;
  for (const chain of project.rig.ikChains) {
    const world = forwardKinematics(project.rig, project.draft);
    const start = world[chain.upperBoneId].start;
    const target = { x: start.x + 100, y: start.y - 80 };
    const result = dragBoneEndpoint(project.rig, project.draft, chain.lowerBoneId, target);
    expect(result.error).toBeLessThan(1e-6);
    expect(() => parseProject({ ...project, draft: result.pose })).not.toThrow();
    const fk = dragBoneEndpoint(project.rig, project.draft, chain.lowerBoneId, target, {
      mode: 'fk',
    });
    expect(fk.pose.localRotations[chain.upperBoneId]).toBe(
      project.draft.localRotations[chain.upperBoneId],
    );
  }
});

it('侧身参数独立于资产，旧姿势默认正面，完整撤销恢复控制器', () => {
  const project = createDefaultProject();
  project.poses.push({ id: 'standing', name: '站立', pose: structuredClone(project.draft) });
  const edited = execute(
    { project, past: [], future: [] },
    {
      label: '转身',
      apply: (next) => {
        next.draft.bodyTurn = 90;
        syncControls(next.rig, next.draft);
      },
    },
  );
  expect(edited.project.poses[0].pose.bodyTurn).toBe(0);
  expect(undo(edited).project.draft).toEqual(project.draft);
  const legacy = JSON.parse(JSON.stringify(project));
  delete legacy.draft.bodyTurn;
  expect(parseProject(legacy).draft.bodyTurn).toBe(0);
  expect(() => parseProject({ ...project, draft: { ...project.draft, bodyTurn: 100 } })).toThrow();
});

it('朝向改变显示顺序，侧身的双脚同向', () => {
  const project = createDefaultProject();
  for (const turn of [-90, 90]) {
    project.draft.bodyTurn = turn;
    const world = forwardKinematics(project.rig, project.draft);
    for (const id of ['leftFoot', 'rightFoot'])
      expect(Math.sign(world[id].end.x - world[id].start.x)).toBe(Math.sign(turn));
    const order = poseDrawOrder(project.rig, project.draft);
    expect(order.indexOf('leftForearm') > order.indexOf('rightForearm')).toBe(turn > 0);
  }
  project.draft.bodyTurn = 0;
  expect(rigForPose(project.rig, project.draft)).toBe(project.rig);
});
