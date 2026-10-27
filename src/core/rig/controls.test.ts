import { describe, expect, it } from 'vitest';
import { createDefaultProject } from '../project/defaultProject';
import { forwardKinematics } from './fk';
import { dragBoneEndpoint } from './dragPose';
import { setChainMode } from './controls';
import { unequalChainFixture } from '../../test/fixtures';
import { setJointLimit } from '../project/jointLimits';
import { parseProject } from '../project/schema';
import { createDefaultPose } from './defaultRig';
import { execute, undo } from '../commands/history';

describe('IK 模式与弯曲方向', () => {
  it('切换控制方式不改变姿势，只初始化选中链的控制器', () => {
    const project = createDefaultProject();
    const chain = project.rig.ikChains[0];
    project.draft.ikControls.rightArm.target = { x: 5000, y: 2000 };
    const before = forwardKinematics(project.rig, project.draft);
    for (const mode of ['fk', 'ik'] as const) {
      const pose = setChainMode(project.rig, project.draft, chain, mode);
      expect(forwardKinematics(project.rig, pose)).toEqual(before);
      expect(pose.ikControls[chain.id].mode).toBe(mode);
      expect(pose.ikControls.rightArm.target).toEqual({ x: 5000, y: 2000 });
    }
  });
  it.each(['leftArm', 'rightArm', 'leftLeg', 'rightLeg'])(
    '%s 翻转保持末端，重复翻转恢复姿势',
    (id) => {
      const project = createDefaultProject();
      const chain = project.rig.ikChains.find((item) => item.id === id)!;
      const before = forwardKinematics(project.rig, project.draft);
      const original = project.draft.ikControls[id];
      const flipped = dragBoneEndpoint(
        project.rig,
        project.draft,
        chain.lowerBoneId,
        original.target,
        { bendSign: original.bendSign === 1 ? -1 : 1 },
      );
      expect(flipped.error).toBeLessThan(1e-6);
      const after = forwardKinematics(project.rig, flipped.pose);
      expect(
        Math.hypot(
          before[chain.upperBoneId].end.x - after[chain.upperBoneId].end.x,
          before[chain.upperBoneId].end.y - after[chain.upperBoneId].end.y,
        ),
      ).toBeGreaterThan(1);
      const restored = dragBoneEndpoint(
        project.rig,
        flipped.pose,
        chain.lowerBoneId,
        original.target,
        { bendSign: original.bendSign },
      );
      for (const bone of project.rig.bones)
        expect(restored.pose.localRotations[bone.id]).toBeCloseTo(
          project.draft.localRotations[bone.id],
        );
    },
  );
  it('FK 拖动腕点只旋转前臂，不改变上臂', () => {
    const project = createDefaultProject();
    const result = dragBoneEndpoint(
      project.rig,
      project.draft,
      'leftForearm',
      { x: 700, y: 400 },
      { mode: 'fk' },
    );
    expect(result.pose.localRotations.leftUpperArm).toBe(0);
    expect(result.pose.localRotations.leftForearm).not.toBe(0);
  });
});

describe('关节约束求解', () => {
  it.each([
    { x: 160, y: 90 },
    { x: 80, y: -30 },
    { x: -30, y: 200 },
    { x: 0, y: 0 },
  ])('有界修正不劣于密集网格基准 %j', (target) => {
    const { rig, pose } = unequalChainFixture();
    rig.bones[0].angleLimit = { min: -0.3, max: 0.8 };
    rig.bones[1].angleLimit = { min: -1.4, max: 0 };
    const result = dragBoneEndpoint(rig, pose, 'lower', target, { bendSign: 1 });
    expect(result.pose.localRotations.upper).toBeGreaterThanOrEqual(-0.3);
    expect(result.pose.localRotations.upper).toBeLessThanOrEqual(0.8);
    expect(result.pose.localRotations.lower).toBeGreaterThanOrEqual(-1.4);
    expect(result.pose.localRotations.lower).toBeLessThanOrEqual(0);
    let reference = Infinity;
    for (let i = 0; i <= 100; i++)
      for (let j = 0; j <= 100; j++) {
        const u = -0.3 + (1.1 * i) / 100;
        const l = -1.4 + (1.4 * j) / 100;
        reference = Math.min(
          reference,
          Math.hypot(
            120 * Math.cos(u) + 75 * Math.cos(u + l) - target.x,
            120 * Math.sin(u) + 75 * Math.sin(u + l) - target.y,
          ),
        );
      }
    expect(result.error).toBeLessThanOrEqual(reference + 0.001);
  });
  it('项目限制同步草稿、资产和序列，重置和撤销仍合法', () => {
    const project = createDefaultProject();
    project.poses.push({ id: 'asset', name: '姿势', pose: structuredClone(project.draft) });
    project.clips.push({
      id: 'clip',
      name: '序列',
      keys: [{ id: 'key', name: '段', durationFrames: 2, pose: structuredClone(project.draft) }],
    });
    const edited = execute(
      { project, past: [], future: [] },
      {
        label: '限制',
        apply: (draft) => setJointLimit(draft, 'leftForearm', { min: 0.1, max: 0.5 }),
      },
    );
    expect(edited.project.draft.localRotations.leftForearm).toBe(0.1);
    expect(edited.project.poses[0].pose.rigRevision).toBe(2);
    expect(edited.project.clips[0].keys[0].pose.rigRevision).toBe(2);
    expect(() =>
      parseProject({ ...edited.project, draft: createDefaultPose(edited.project.rig) }),
    ).not.toThrow();
    expect(undo(edited).project.rig).toEqual(project.rig);
  });
  it('限制改变默认弯曲侧后，重置控制器与实际姿势一致', () => {
    const project = createDefaultProject();
    setJointLimit(project, 'rightForearm', { min: 0.5, max: 1 });
    const pose = createDefaultPose(project.rig);
    const world = forwardKinematics(project.rig, pose);
    expect(Math.sin(world.rightForearm.angle - world.rightUpperArm.angle)).toBeGreaterThan(0);
    expect(pose.ikControls.rightArm.bendSign).toBe(-1);
  });
});
