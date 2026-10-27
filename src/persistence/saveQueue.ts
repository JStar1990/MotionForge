import type { Project } from '../core/project/schema';
import type { Assets } from './files';

// A single writer prevents a slow old save from overtaking a newer revision.
export class SaveQueue {
  private tail: Promise<void> = Promise.resolve();
  constructor(private write: (project: Project, assets: Assets) => Promise<void>) {}
  enqueue(project: Project, assets: Assets) {
    const snapshot = structuredClone(project);
    const assetSnapshot = { ...assets };
    const next = this.tail.catch(() => {}).then(() => this.write(snapshot, assetSnapshot));
    this.tail = next;
    return next;
  }
}
