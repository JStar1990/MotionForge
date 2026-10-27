import { createDefaultPose, createDefaultRig } from '../rig/defaultRig';
import { parseProject, type Project } from './schema';

export function createDefaultProject(id: string = crypto.randomUUID()): Project {
  const rig = createDefaultRig();
  return parseProject({
    schemaVersion: 1,
    id,
    name: '未命名工程',
    revision: 0,
    canvas: { width: 1024, height: 1024, background: null },
    fps: 12,
    defaultDurationFrames: 2,
    rig,
    draft: createDefaultPose(rig),
    poses: [],
    clips: [],
    referenceImages: [],
  });
}
