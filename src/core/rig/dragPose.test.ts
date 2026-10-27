import { describe, expect, it } from 'vitest';
import { createDefaultProject } from '../project/defaultProject';
import { parseProject } from '../project/schema';
import { forwardKinematics } from './fk';
import { dragBoneEndpoint } from './dragPose';
import { unequalChainFixture } from '../../test/fixtures';

describe('骨骼点拖动', () => {
  it.each(['leftArm', 'rightArm', 'leftLeg', 'rightLeg'])('%s IK 到达目标且骨长不变', (id) => {
    const project = createDefaultProject();
    project.draft.rootRotation = 0.4;
    const chain = project.rig.ikChains.find((item) => item.id === id)!;
    const world = forwardKinematics(project.rig, project.draft);
    const start = world[chain.upperBoneId].start;
    const target = { x: start.x + 80, y: start.y + 80 };
    const before = structuredClone(project.draft);
    const result = dragBoneEndpoint(project.rig, before, chain.lowerBoneId, target);
    expect(result.error).toBeLessThan(1e-6);
    expect(before).toEqual(project.draft);
    const next = forwardKinematics(project.rig, result.pose);
    for (const bone of project.rig.bones) {
      expect(
        Math.hypot(
          next[bone.id].end.x - next[bone.id].start.x,
          next[bone.id].end.y - next[bone.id].start.y,
        ),
      ).toBeCloseTo(bone.length);
    }
    expect(() => parseProject({ ...project, draft: result.pose })).not.toThrow();
  });
  it('零距离、远近不可达和完全伸直保持有效解', () => {
    const { rig, pose } = unequalChainFixture();
    for (const target of [
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      { x: 195, y: 0 },
      { x: 10000, y: 0 },
    ]) {
      const result = dragBoneEndpoint(rig, pose, 'lower', target);
      expect(Number.isFinite(result.error)).toBe(true);
      expect(Math.hypot(result.endpoint.x, result.endpoint.y)).toBeGreaterThanOrEqual(45 - 1e-6);
      expect(Math.hypot(result.endpoint.x, result.endpoint.y)).toBeLessThanOrEqual(195 + 1e-6);
    }
    rig.bones[1].length = 120;
    const result = dragBoneEndpoint(rig, pose, 'lower', { x: 0, y: 0 });
    expect(result.error).toBeLessThan(1e-6);
    expect(Object.values(result.pose.localRotations).every(Number.isFinite)).toBe(true);
  });
  it('保持原有弯曲侧，FK 末端在父空间旋转且起点不变', () => {
    const { rig, pose } = unequalChainFixture();
    for (const angle of [-0.5, 0.5]) {
      pose.localRotations.lower = angle;
      const result = dragBoneEndpoint(rig, pose, 'lower', { x: 80, y: 80 });
      expect(Math.sign(result.pose.localRotations.lower)).toBe(Math.sign(angle));
    }
    const project = createDefaultProject();
    project.draft.rootRotation = 1;
    const before = forwardKinematics(project.rig, project.draft);
    const target = { x: before.head.start.x + 64, y: before.head.start.y };
    const result = dragBoneEndpoint(project.rig, project.draft, 'head', target);
    expect(result.error).toBeLessThan(1e-6);
    expect(forwardKinematics(project.rig, result.pose).head.start).toEqual(before.head.start);
  });
  it('关节限制夹取后反馈真实误差，不声称到达目标', () => {
    const { rig, pose } = unequalChainFixture();
    rig.bones[0].angleLimit = { min: 0, max: 0 };
    rig.bones[1].angleLimit = { min: 0, max: 0 };
    const result = dragBoneEndpoint(rig, pose, 'lower', { x: 0, y: 195 });
    expect(result.endpoint).toEqual({ x: 195, y: 0 });
    expect(result.error).toBeGreaterThan(200);
  });
});
