import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { initialPole, limbChains, solveLimb } from './limbIK';

describe.each(['male', 'female'])('IK on shipped %s skeleton', (model) => {
  for (const [endName, [upperName, lowerName]] of Object.entries(limbChains)) {
    it(`${endName}: reachable, unreachable, folded targets preserve lengths and local offsets`, () => {
      const data = readFileSync(`public/models/quaternius/mannequin-${model}.glb`);
      const gltf = JSON.parse(data.subarray(20, 20 + data.readUInt32LE(12)).toString());
      const nodes: THREE.Bone[] = gltf.nodes.map(
        (node: {
          name?: string;
          translation?: number[];
          rotation?: number[];
          scale?: number[];
        }) => {
          const bone = new THREE.Bone();
          bone.name = node.name ?? '';
          if (node.translation) bone.position.fromArray(node.translation);
          if (node.rotation) bone.quaternion.fromArray(node.rotation);
          if (node.scale) bone.scale.fromArray(node.scale);
          return bone;
        },
      );
      gltf.nodes.forEach((node: { children?: number[] }, index: number) =>
        node.children?.forEach((child) => nodes[index].add(nodes[child])),
      );
      const root = new THREE.Group();
      nodes.filter((node) => !node.parent).forEach((node) => root.add(node));
      root.rotation.set(0.2, 0.6, -0.1);
      root.position.set(1, 2, 3);
      root.updateMatrixWorld(true);
      const upper = nodes.find((node) => node.name === upperName)!;
      const lower = nodes.find((node) => node.name === lowerName)!;
      const end = nodes.find((node) => node.name === endName)!;
      expect(lower.parent).toBe(upper);
      expect(end.parent).toBe(lower);
      const world = (bone: THREE.Bone) => bone.getWorldPosition(new THREE.Vector3());
      const a = world(upper),
        b = world(lower),
        c = world(end);
      const lengths = [a.distanceTo(b), b.distanceTo(c)];
      const originals = [upper, lower, end].map((bone) => ({
        q: bone.quaternion.clone(),
        p: bone.position.clone(),
        s: bone.scale.clone(),
      }));
      const pole = initialPole(upper, lower, end);
      const direction = c.clone().sub(a).normalize();
      const targets = [
        a.clone().addScaledVector(direction, (lengths[0] + lengths[1]) * 0.7),
        a.clone().addScaledVector(direction, 10),
        a.clone(),
      ];
      targets.forEach((target, index) => {
        [upper, lower, end].forEach((bone, i) => bone.quaternion.copy(originals[i].q));
        const error = solveLimb(upper, lower, end, target, pole);
        expect(Number.isFinite(error)).toBe(true);
        if (index === 0) expect(error).toBeLessThan(0.0001);
        expect(world(upper).distanceTo(world(lower))).toBeCloseTo(lengths[0], 5);
        expect(world(lower).distanceTo(world(end))).toBeCloseTo(lengths[1], 5);
        [upper, lower, end].forEach((bone, i) => {
          expect(bone.position.toArray()).toEqual(originals[i].p.toArray());
          expect(bone.scale.toArray()).toEqual(originals[i].s.toArray());
          expect(bone.quaternion.toArray().every(Number.isFinite)).toBe(true);
        });
      });
    });
  }
});

it('pole changes bend direction while preserving endpoint and orientation', () => {
  const root = new THREE.Group(),
    upper = new THREE.Bone(),
    lower = new THREE.Bone(),
    end = new THREE.Bone();
  root.add(upper);
  upper.add(lower);
  lower.add(end);
  lower.position.x = 1;
  end.position.x = 1;
  const target = new THREE.Vector3(1.2, 0, 0);
  const orientation = end.getWorldQuaternion(new THREE.Quaternion());
  solveLimb(upper, lower, end, target, new THREE.Vector3(0, 1, 0));
  expect(lower.getWorldPosition(new THREE.Vector3()).y).toBeGreaterThan(0.7);
  expect(end.getWorldPosition(new THREE.Vector3()).distanceTo(target)).toBeLessThan(1e-6);
  solveLimb(upper, lower, end, target, new THREE.Vector3(0, -1, 0));
  expect(lower.getWorldPosition(new THREE.Vector3()).y).toBeLessThan(-0.7);
  expect(end.getWorldPosition(new THREE.Vector3()).distanceTo(target)).toBeLessThan(1e-6);
  expect(end.getWorldQuaternion(new THREE.Quaternion()).angleTo(orientation)).toBeLessThan(1e-6);
});
