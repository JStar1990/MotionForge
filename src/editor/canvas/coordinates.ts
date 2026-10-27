import type { Vec2 } from '../../core/project/schema';
export interface Viewport {
  x: number;
  y: number;
  scale: number;
}
export function screenToProject(point: Vec2, viewport: Viewport): Vec2 {
  return { x: (point.x - viewport.x) / viewport.scale, y: (point.y - viewport.y) / viewport.scale };
}
export function projectToScreen(point: Vec2, viewport: Viewport): Vec2 {
  return { x: point.x * viewport.scale + viewport.x, y: point.y * viewport.scale + viewport.y };
}
