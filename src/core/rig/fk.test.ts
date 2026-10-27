import { describe, expect, it } from 'vitest';
import { forwardKinematics } from './fk';
import { createDefaultProject } from '../project/defaultProject';
import { unequalChainFixture } from '../../test/fixtures';
import { projectToScreen, screenToProject } from '../../editor/canvas/coordinates';

describe('FK 与坐标约定', () => {
  it('旋转父骨骼时正确变换连接偏移，骨长保持不变', () => {
    const { rig, pose } = unequalChainFixture();
    pose.rootPosition = { x: 10, y: 20 };
    pose.localRotations.upper = Math.PI / 2;
    pose.localRotations.lower = -Math.PI / 2;
    const world = forwardKinematics(rig, pose);
    expect(world.lower.start.x).toBeCloseTo(10);
    expect(world.lower.start.y).toBeCloseTo(140);
    expect(world.lower.end.x).toBeCloseTo(85);
    expect(world.lower.end.y).toBeCloseTo(140);
    rig.bones.reverse();
    expect(forwardKinematics(rig, pose)).toEqual(world);
  });
  it('默认骨架四条链首尾相接，控制器位于末端', () => {
    const project = createDefaultProject();
    const world = forwardKinematics(project.rig, project.draft);
    for (const chain of project.rig.ikChains) {
      expect(world[chain.upperBoneId].end.x).toBeCloseTo(world[chain.lowerBoneId].start.x);
      expect(world[chain.upperBoneId].end.y).toBeCloseTo(world[chain.lowerBoneId].start.y);
      expect(project.draft.ikControls[chain.id].target).toEqual(world[chain.lowerBoneId].end);
    }
    for (const bone of project.rig.bones) {
      const { start, end } = world[bone.id];
      expect(Math.hypot(end.x - start.x, end.y - start.y)).toBeCloseTo(bone.length);
    }
  });
  it('缩放平移后的屏幕坐标可逆', () => {
    const viewport = { x: -300, y: 108, scale: 1.75 };
    const point = { x: 512, y: 500 };
    expect(screenToProject(projectToScreen(point, viewport), viewport)).toEqual(point);
  });
});
