import type { IKChain, PoseSnapshot, RigDefinition } from '../project/schema';
import { forwardKinematics } from './fk';

export function syncControls(rig: RigDefinition, pose: PoseSnapshot) {
  const world = forwardKinematics(rig, pose);
  for (const chain of rig.ikChains) {
    const control = pose.ikControls[chain.id];
    control.target = { ...world[chain.lowerBoneId].end };
    const cross = Math.sin(world[chain.lowerBoneId].angle - world[chain.upperBoneId].angle);
    if (Math.abs(cross) > 1e-8) control.bendSign = cross > 0 ? -1 : 1;
  }
}

export function setChainMode(
  rig: RigDefinition,
  pose: PoseSnapshot,
  chain: IKChain,
  mode: 'ik' | 'fk',
) {
  const next = structuredClone(pose);
  syncControls(rig, next);
  next.ikControls[chain.id].mode = mode;
  for (const item of rig.ikChains) {
    if (item.id !== chain.id) next.ikControls[item.id] = structuredClone(pose.ikControls[item.id]);
  }
  return next;
}
