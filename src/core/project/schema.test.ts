import { describe, expect, it } from 'vitest';
import { createDefaultProject } from './defaultProject';
import { parseProject, type Project } from './schema';
import { corruptedProjectFixture, exposureFixture } from '../../test/fixtures';

describe('工程数据校验', () => {
  it('默认工程包含草稿、17 根骨骼、四条 IK 链且可 JSON 往返', () => {
    const project = createDefaultProject('default');
    expect(project.rig.bones).toHaveLength(17);
    expect(project.rig.ikChains).toHaveLength(4);
    expect(parseProject(JSON.parse(JSON.stringify(project)))).toEqual(project);
  });
  const invalidCases: [string, (project: Project) => void][] = [
    [
      '负骨长',
      (project) => {
        project.rig.bones[0].length = -1;
      },
    ],
    [
      '零骨长',
      (project) => {
        project.rig.bones[0].length = 0;
      },
    ],
    [
      '非有限数值',
      (project) => {
        project.draft.rootPosition.x = Infinity;
      },
    ],
    [
      'NaN',
      (project) => {
        project.draft.rootRotation = NaN;
      },
    ],
    [
      '重复骨骼 ID',
      (project) => {
        project.rig.bones[1].id = project.rig.bones[0].id;
      },
    ],
    [
      '缺失父节点',
      (project) => {
        project.rig.bones[1].parentId = 'missing';
      },
    ],
    [
      '多个根节点',
      (project) => {
        project.rig.bones[1].parentId = null;
      },
    ],
    [
      '绘制顺序重复',
      (project) => {
        project.rig.drawOrder[0] = project.rig.drawOrder[1];
      },
    ],
    [
      'IK 链断开',
      (project) => {
        project.rig.ikChains[0].lowerBoneId = 'head';
      },
    ],
    [
      'IK 连接偏移错误',
      (project) => {
        project.rig.bones.find((bone) => bone.id === 'leftForearm')!.offset.x = 3;
      },
    ],
    [
      '缺失旋转',
      (project) => {
        delete project.draft.localRotations.head;
      },
    ],
    [
      '多余旋转',
      (project) => {
        project.draft.localRotations.unknown = 0;
      },
    ],
    [
      '缺失控制器',
      (project) => {
        delete project.draft.ikControls.leftArm;
      },
    ],
    [
      '骨架版本不匹配',
      (project) => {
        project.draft.rigRevision = 2;
      },
    ],
    [
      '小数 FPS',
      (project) => {
        project.fps = 12.5;
      },
    ],
    [
      '零时长',
      (project) => {
        project.clips[0].keys[0].durationFrames = 0;
      },
    ],
    [
      '非整数时长',
      (project) => {
        project.clips[0].keys[0].durationFrames = 1.5;
      },
    ],
    [
      '重复关键姿势 ID',
      (project) => {
        project.clips[0].keys[1].id = project.clips[0].keys[0].id;
      },
    ],
    [
      '过长序列',
      (project) => {
        project.clips[0].keys[0].durationFrames = 3000;
      },
    ],
    [
      '资产骨架不匹配',
      (project) => {
        project.poses = [{ id: 'p', name: '错误', pose: { ...project.draft, rigId: 'other' } }];
      },
    ],
    [
      '关键姿势骨架不匹配',
      (project) => {
        project.clips[0].keys[0].pose.rigRevision = 99;
      },
    ],
    [
      '无效角度范围',
      (project) => {
        project.rig.bones[0].angleLimit = { min: 1, max: -1 };
      },
    ],
  ];
  it.each(invalidCases)('拒绝%s', (_, mutate) => {
    const project = createDefaultProject('invalid');
    project.clips = [exposureFixture()];
    mutate(project);
    expect(() => parseProject(project)).toThrow();
  });
  it('拒绝循环与未知高版本', () => {
    expect(() => parseProject(corruptedProjectFixture())).toThrow();
    expect(() => parseProject({ ...createDefaultProject(), schemaVersion: 2 })).toThrow();
  });
});
