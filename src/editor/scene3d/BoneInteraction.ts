import { initialPole, limbChains, solveLimb } from './limbIK';
import * as THREE from 'three';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { boneLabels, type BoneRig } from './PoseControls';

/** View-only helpers and a single undo transaction per pointer gesture. */
export class BoneInteraction {
  readonly overlay = new THREE.Group();
  private transform: TransformControls;
  private markers: THREE.Mesh[] = [];
  private selected = '';
  private links: Array<[THREE.Bone, THREE.Bone]> = [];
  private lines = new THREE.LineSegments(
    new THREE.BufferGeometry(),
    new THREE.LineBasicMaterial({
      color: 0x57d6ff,
      depthTest: false,
      transparent: true,
      opacity: 0.6,
    }),
  );
  private before: Map<string, THREE.Quaternion> | null = null;
  private mode: 'rotate' | 'translate' = 'rotate';
  private space: 'local' | 'world' = 'local';
  private target = new THREE.Object3D();
  private pole = new THREE.Vector3();
  onFeedback?: (message: string) => void;
  private cancelled = false;
  onSelect?: (name: string) => void;
  onCommit?: (changes: Record<string, [number, number, number, number]>) => void;
  constructor(
    private rig: BoneRig,
    camera: THREE.Camera,
    private canvas: HTMLCanvasElement,
    private orbit: OrbitControls,
  ) {
    this.transform = new TransformControls(camera, canvas);
    this.transform.setMode('rotate');
    this.transform.setSpace('local');
    this.transform.setSize(0.7);
    this.overlay.add(this.transform.getHelper(), this.target);
    for (const name of rig.bones.keys()) {
      if (!boneLabels[name]) continue;
      const marker = new THREE.Mesh(
        new THREE.SphereGeometry(0.018, 10, 8),
        new THREE.MeshBasicMaterial({ color: 0x57d6ff, depthTest: false }),
      );
      marker.name = name;
      marker.renderOrder = 1000;
      this.markers.push(marker);
      this.overlay.add(marker);
    }
    for (const marker of this.markers) {
      const bone = rig.bones.get(marker.name)!;
      let parent = bone.parent;
      while (parent && !boneLabels[parent.name]) parent = parent.parent;
      if (parent && (parent as THREE.Bone).isBone) this.links.push([bone, parent as THREE.Bone]);
    }
    this.lines.geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array(this.links.length * 6), 3),
    );
    this.lines.renderOrder = 999;
    this.overlay.add(this.lines);
    this.transform.addEventListener('mouseDown', () => {
      this.before = new Map(
        [...this.rig.bones].map(([name, bone]) => [name, bone.quaternion.clone()]),
      );
      const chain = this.chain();
      if (this.mode === 'translate' && chain) this.pole.copy(initialPole(...chain));
      this.cancelled = false;
      this.orbit.enabled = false;
    });
    this.transform.addEventListener('objectChange', () => {
      if (!this.before) return;
      if (this.mode === 'translate' || this.cancelled) this.restore();
      if (this.cancelled) return;
      if (this.mode === 'translate') {
        const chain = this.chain();
        if (chain) {
          const error = solveLimb(...chain, this.target.position, this.pole);
          this.onFeedback?.(
            error > 0.005
              ? '目标超出可达范围，已保持骨长并停在可达位置。'
              : '拖动手脚目标：四肢跟随，骨长保持不变。',
          );
        }
      }
    });
    this.transform.addEventListener('mouseUp', () => {
      const changes: Record<string, [number, number, number, number]> = {};
      if (this.before && !this.cancelled) {
        for (const [name, bone] of this.rig.bones) {
          if (
            bone.quaternion
              .toArray()
              .some(
                (value, index) => Math.abs(value - this.before!.get(name)!.toArray()[index]) > 1e-9,
              )
          ) {
            changes[name] = this.rig.rest
              .get(name)!
              .clone()
              .invert()
              .multiply(bone.quaternion)
              .normalize()
              .toArray();
          }
        }
        if (Object.keys(changes).length) this.onCommit?.(changes);
      }
      this.before = null;
      this.orbit.enabled = true;
      this.syncTarget();
    });
    this.canvas.addEventListener('pointerdown', this.pick, true);
    window.addEventListener('keydown', this.key);
    this.select('upperarm_l');
  }
  bind(
    select?: (name: string) => void,
    commit?: (changes: Record<string, [number, number, number, number]>) => void,
    feedback?: (message: string) => void,
  ) {
    this.onSelect = select;
    this.onCommit = commit;
    this.onFeedback = feedback;
  }
  select(name: string) {
    if (this.transform.dragging) return;
    const bone = this.rig.bones.get(name);
    if (!bone) return;
    this.selected = name;
    this.attach();
    for (const marker of this.markers)
      (marker.material as THREE.MeshBasicMaterial).color.set(
        marker.name === name ? 0xffc857 : 0x57d6ff,
      );
  }
  setSpace(space: 'local' | 'world') {
    this.space = space;
    if (!this.transform.dragging)
      this.transform.setSpace(this.mode === 'translate' ? 'world' : space);
  }
  setMode(mode: 'rotate' | 'translate') {
    if (this.transform.dragging) return;
    this.mode = mode;
    this.attach();
  }
  private chain(): [THREE.Bone, THREE.Bone, THREE.Bone] | null {
    const names = limbChains[this.selected];
    if (!names) return null;
    const upper = this.rig.bones.get(names[0]),
      lower = this.rig.bones.get(names[1]),
      end = this.rig.bones.get(this.selected);
    return upper && lower && end && lower.parent === upper && end.parent === lower
      ? [upper, lower, end]
      : null;
  }
  private syncTarget() {
    this.rig.bones.get(this.selected)?.getWorldPosition(this.target.position);
    this.target.updateMatrixWorld(true);
  }
  private attach() {
    this.syncTarget();
    this.transform.setMode(this.mode);
    this.transform.setSpace(this.mode === 'translate' ? 'world' : this.space);
    if (this.mode === 'translate' && !this.chain()) {
      this.transform.detach();
      this.onFeedback?.('平移模式请选择左手、右手、左脚或右脚。');
    } else {
      this.transform.attach(
        this.mode === 'translate' ? this.target : this.rig.bones.get(this.selected)!,
      );
      this.onFeedback?.(
        this.mode === 'translate'
          ? '拖动箭头或平面方块移动手脚；中心方块沿视平面移动。'
          : '拖动旋转环调整骨骼。',
      );
    }
  }
  private restore() {
    if (this.before)
      for (const [name, q] of this.before) this.rig.bones.get(name)!.quaternion.copy(q);
  }
  focus() {
    if (this.transform.dragging) return;
    const target = this.rig.bones.get(this.selected)!.getWorldPosition(new THREE.Vector3());
    const offset = this.transform.camera.position.clone().sub(this.orbit.target);
    this.orbit.target.copy(target);
    this.transform.camera.position.copy(target).add(offset);
    this.orbit.update();
  }
  setVisible(visible: boolean) {
    this.overlay.visible = visible;
    this.transform.enabled = visible;
  }
  update() {
    if (!this.transform.dragging) this.syncTarget();
    const positions = this.lines.geometry.getAttribute('position') as THREE.BufferAttribute;
    const point = new THREE.Vector3();
    this.links.forEach(([bone, parent], index) => {
      bone.getWorldPosition(point);
      positions.setXYZ(index * 2, point.x, point.y, point.z);
      parent.getWorldPosition(point);
      positions.setXYZ(index * 2 + 1, point.x, point.y, point.z);
    });
    positions.needsUpdate = true;
    this.lines.geometry.computeBoundingSphere();
    for (const marker of this.markers)
      this.rig.bones.get(marker.name)!.getWorldPosition(marker.position);
  }
  private pick = (event: PointerEvent) => {
    if (event.button !== 0 || !this.overlay.visible || this.transform.dragging) return;
    const rect = this.canvas.getBoundingClientRect();
    const ray = new THREE.Raycaster();
    ray.setFromCamera(
      new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        (-(event.clientY - rect.top) / rect.height) * 2 + 1,
      ),
      this.transform.camera,
    );
    // Rotation rings take priority over joint markers.
    this.transform.pointerHover({
      x: ((event.clientX - rect.left) / rect.width) * 2 - 1,
      y: (-(event.clientY - rect.top) / rect.height) * 2 + 1,
      button: event.button,
    } as PointerEvent);
    if (this.transform.axis && !event.altKey) return;
    const hits = ray
      .intersectObjects(this.markers, false)
      .filter((hit, index, all) => all.findIndex((other) => other.object === hit.object) === index);
    const currentIndex = hits.findIndex((hit) => hit.object.name === this.selected);
    const hit = hits[event.altKey ? (currentIndex + 1) % hits.length : 0];
    if (hit) {
      this.select(hit.object.name);
      this.onSelect?.(hit.object.name);
      event.stopImmediatePropagation();
    }
  };
  private key = (event: KeyboardEvent) => {
    if (event.key !== 'Escape' || !this.before) return;
    this.cancelled = true;
    this.restore();
    this.syncTarget();
    this.onFeedback?.('已取消本次拖动。');
    event.preventDefault();
  };
  dispose() {
    this.canvas.removeEventListener('pointerdown', this.pick, true);
    window.removeEventListener('keydown', this.key);
    this.transform.dispose();
    this.overlay.removeFromParent();
    this.lines.geometry.dispose();
    this.lines.material.dispose();
    for (const marker of this.markers) {
      marker.geometry.dispose();
      (marker.material as THREE.Material).dispose();
    }
    this.orbit.enabled = true;
  }
}
