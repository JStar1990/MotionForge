import type { PoseSnapshot, Project } from '../../core/project/schema';
import { syncControls } from '../../core/rig/controls';

export function syncFKControls(project: Project, pose: PoseSnapshot) {
  syncControls(project.rig, pose);
}
