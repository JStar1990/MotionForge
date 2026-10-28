import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { jointLimits, limitDelta } from './jointLimits';

describe('joint authoring limits', () => {
  for (const name of Object.keys(jointLimits)) {
    it(`${name}: neutral, extreme and repeated clamping`, () => {
      expect(limitDelta(name, new THREE.Quaternion()).limited).toBe(false);
      for (const angles of [
        [170, 40, -160],
        [-100, -80, 120],
        [30, 0, 0],
      ]) {
        const q = new THREE.Quaternion().setFromEuler(
          new THREE.Euler(...(angles.map(THREE.MathUtils.degToRad) as [number, number, number])),
        );
        const result = limitDelta(name, q);
        const euler = new THREE.Euler().setFromQuaternion(result.rotation);
        for (const axis of ['x', 'y', 'z'] as const) {
          const value = THREE.MathUtils.radToDeg(euler[axis]);
          expect(value).toBeGreaterThanOrEqual(jointLimits[name][axis][0] - 1e-6);
          expect(value).toBeLessThanOrEqual(jointLimits[name][axis][1] + 1e-6);
        }
        expect(limitDelta(name, result.rotation).limited).toBe(false);
        expect(Math.abs(result.rotation.length() - 1)).toBeLessThan(1e-6);
      }
    });
  }
  it('knees and elbows reject reverse bending', () => {
    const reversed = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -1);
    for (const name of ['calf_l', 'calf_r', 'lowerarm_l', 'lowerarm_r']) {
      const result = limitDelta(name, reversed);
      expect(result.limited).toBe(true);
      expect(result.rotation.angleTo(new THREE.Quaternion())).toBeLessThan(1e-6);
    }
  });
});
