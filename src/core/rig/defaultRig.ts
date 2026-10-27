import type { BoneDefinition, PoseSnapshot, RigDefinition } from '../project/schema';
import { forwardKinematics } from './fk';

const rad = (degrees: number) => (degrees * Math.PI) / 180;
function bone(
  id: string,
  name: string,
  parentId: string | null,
  x: number,
  y: number,
  length: number,
  degrees: number,
  side: BoneDefinition['side'] = 'center',
): BoneDefinition {
  return { id, name, parentId, offset: { x, y }, length, restAngle: rad(degrees), side };
}

export function createDefaultRig(): RigDefinition {
  // Character's anatomical left appears on the viewer's right in the front view.
  const bones = [
    bone('torso', '躯干', null, 0, 0, 185, -90),
    bone('neck', '颈部', 'torso', 185, 0, 32, 0),
    bone('head', '头部', 'neck', 32, 0, 64, 0),
    bone('leftShoulder', '左肩', 'torso', 174, 0, 66, 90, 'left'),
    bone('leftUpperArm', '左上臂', 'leftShoulder', 66, 0, 115, 68, 'left'),
    bone('leftForearm', '左前臂', 'leftUpperArm', 115, 0, 105, 15, 'left'),
    bone('leftHand', '左手', 'leftForearm', 105, 0, 34, 0, 'left'),
    bone('rightShoulder', '右肩', 'torso', 174, 0, 66, -90, 'right'),
    bone('rightUpperArm', '右上臂', 'rightShoulder', 66, 0, 115, -68, 'right'),
    bone('rightForearm', '右前臂', 'rightUpperArm', 115, 0, 105, -15, 'right'),
    bone('rightHand', '右手', 'rightForearm', 105, 0, 34, 0, 'right'),
    bone('leftThigh', '左大腿', 'torso', 0, 40, 152, 174, 'left'),
    bone('leftShin', '左小腿', 'leftThigh', 152, 0, 145, 9, 'left'),
    bone('leftFoot', '左脚', 'leftShin', 145, 0, 52, -83, 'left'),
    bone('rightThigh', '右大腿', 'torso', 0, -40, 152, -174, 'right'),
    bone('rightShin', '右小腿', 'rightThigh', 152, 0, 145, -9, 'right'),
    bone('rightFoot', '右脚', 'rightShin', 145, 0, 52, 83, 'right'),
  ];
  return {
    id: 'human-2d-v1',
    revision: 1,
    bones,
    drawOrder: bones.map((item) => item.id),
    ikChains: [
      { id: 'leftArm', upperBoneId: 'leftUpperArm', lowerBoneId: 'leftForearm' },
      { id: 'rightArm', upperBoneId: 'rightUpperArm', lowerBoneId: 'rightForearm' },
      { id: 'leftLeg', upperBoneId: 'leftThigh', lowerBoneId: 'leftShin' },
      { id: 'rightLeg', upperBoneId: 'rightThigh', lowerBoneId: 'rightShin' },
    ],
  };
}

export function createDefaultPose(rig: RigDefinition, bodyTurn = 0): PoseSnapshot {
  const pose: PoseSnapshot = {
    rigId: rig.id,
    rigRevision: rig.revision,
    rootPosition: { x: 512, y: 500 },
    rootRotation: 0,
    bodyTurn,
    localRotations: Object.fromEntries(
      rig.bones.map((bone) => [
        bone.id,
        bone.angleLimit ? Math.max(bone.angleLimit.min, Math.min(bone.angleLimit.max, 0)) : 0,
      ]),
    ),
    ikControls: {},
  };
  const world = forwardKinematics(rig, pose);
  for (const chain of rig.ikChains) {
    const cross = Math.sin(world[chain.lowerBoneId].angle - world[chain.upperBoneId].angle);
    pose.ikControls[chain.id] = {
      target: { ...world[chain.lowerBoneId].end },
      bendSign:
        Math.abs(cross) > 1e-8 ? (cross > 0 ? -1 : 1) : chain.id.startsWith('left') ? -1 : 1,
      mode: 'ik',
      pinned: false,
    };
  }
  return pose;
}
