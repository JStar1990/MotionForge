import { createDefaultProject } from '../core/project/defaultProject';
import { createDefaultPose } from '../core/rig/defaultRig';
import type { Clip, RigDefinition } from '../core/project/schema';

export function exposureFixture(): Clip {
  const project = createDefaultProject('fixture');
  return {
    id: 'abc',
    name: 'A×3 / B×2 / C×4',
    keys: [3, 2, 4].map((durationFrames, index) => ({
      id: `key-${index}`,
      name: ['A', 'B', 'C'][index],
      durationFrames,
      pose: { ...structuredClone(project.draft), rootPosition: { x: 400 + index * 100, y: 500 } },
    })),
  };
}

export function unequalChainFixture() {
  const rig: RigDefinition = {
    id: 'two-bones',
    revision: 1,
    bones: [
      {
        id: 'upper',
        name: '上段',
        parentId: null,
        offset: { x: 0, y: 0 },
        length: 120,
        restAngle: 0,
        side: 'center',
      },
      {
        id: 'lower',
        name: '下段',
        parentId: 'upper',
        offset: { x: 120, y: 0 },
        length: 75,
        restAngle: 0,
        side: 'center',
      },
    ],
    ikChains: [{ id: 'limb', upperBoneId: 'upper', lowerBoneId: 'lower' }],
    drawOrder: ['upper', 'lower'],
  };
  const pose = createDefaultPose(rig);
  pose.rootPosition = { x: 0, y: 0 };
  pose.ikControls.limb.target = { x: 195, y: 0 };
  return { rig, pose };
}

export function corruptedProjectFixture() {
  const project = createDefaultProject('corrupted');
  project.rig.bones[0].parentId = 'head';
  return project;
}
