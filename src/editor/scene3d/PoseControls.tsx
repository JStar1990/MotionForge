import { useState } from 'react';
import * as THREE from 'three';

export type BoneRig = { bones: Map<string, THREE.Bone>; rest: Map<string, THREE.Quaternion> };
type Pose = Record<string, [number, number, number, number]>;
const labels: Record<string, string> = {
  pelvis: '骨盆',
  spine_01: '下脊柱',
  spine_02: '中脊柱',
  spine_03: '胸腔',
  neck_01: '颈部',
  Head: '头部',
  clavicle_l: '左肩',
  clavicle_r: '右肩',
  upperarm_l: '左上臂',
  upperarm_r: '右上臂',
  lowerarm_l: '左前臂',
  lowerarm_r: '右前臂',
  hand_l: '左手',
  hand_r: '右手',
  thigh_l: '左大腿',
  thigh_r: '右大腿',
  calf_l: '左小腿',
  calf_r: '右小腿',
  foot_l: '左脚',
  foot_r: '右脚',
};
export function applyPose(rig: BoneRig, pose: Pose) {
  for (const [name, bone] of rig.bones) {
    bone.quaternion.copy(rig.rest.get(name)!);
    if (pose[name]) bone.quaternion.multiply(new THREE.Quaternion(...pose[name])).normalize();
  }
}
function Angle({
  label,
  value,
  commit,
}: {
  label: string;
  value: number;
  commit: (value: number) => void;
}) {
  return (
    <label>
      {label}
      <input
        key={value}
        aria-label={label}
        type="number"
        step="5"
        min="-180"
        max="180"
        defaultValue={Number(value.toFixed(2))}
        onBlur={(event) => {
          const next = Number(event.target.value);
          if (event.target.value.trim() && Number.isFinite(next) && Math.abs(next) <= 180)
            commit(next);
          else event.target.value = String(Number(value.toFixed(2)));
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur();
          if (event.key === 'Escape') {
            event.currentTarget.value = String(Number(value.toFixed(2)));
            event.currentTarget.blur();
          }
        }}
      />
    </label>
  );
}
export function PoseControls({ rig }: { rig: BoneRig }) {
  const [selected, select] = useState('upperarm_l');
  const [pose, setPose] = useState<Pose>({});
  const [past, setPast] = useState<Pose[]>([]);
  const [future, setFuture] = useState<Pose[]>([]);
  function commit(next: Pose) {
    if (JSON.stringify(next) === JSON.stringify(pose)) return;
    setPast([...past, structuredClone(pose)].slice(-100));
    setFuture([]);
    setPose(next);
    applyPose(rig, next);
  }
  const rotation = new THREE.Euler().setFromQuaternion(
    new THREE.Quaternion(...(pose[selected] ?? [0, 0, 0, 1])),
    'XYZ',
  );
  return (
    <section className="fk-controls">
      <h3>骨骼姿势 · FK</h3>
      <p>相对绑定姿态的局部 XYZ 旋转（度）。按 Enter 或移开焦点提交。</p>
      <select
        aria-label="选择 3D 骨骼"
        value={selected}
        onChange={(event) => select(event.target.value)}
      >
        {[...rig.bones.keys()]
          .filter((name) => labels[name])
          .map((name) => (
            <option key={name} value={name}>
              {labels[name]}
            </option>
          ))}
      </select>
      {(['x', 'y', 'z'] as const).map((axis) => (
        <Angle
          key={selected + axis + JSON.stringify(pose[selected])}
          label={`骨骼旋转 ${axis.toUpperCase()}`}
          value={THREE.MathUtils.radToDeg(rotation[axis])}
          commit={(value) => {
            const next = rotation.clone();
            next[axis] = THREE.MathUtils.degToRad(value);
            const q = new THREE.Quaternion().setFromEuler(next).normalize();
            commit({ ...pose, [selected]: q.toArray() });
          }}
        />
      ))}
      <div>
        <button
          disabled={!past.length}
          onClick={() => {
            const previous = past.at(-1)!;
            setFuture([...future, pose]);
            setPast(past.slice(0, -1));
            setPose(previous);
            applyPose(rig, previous);
          }}
        >
          撤销姿势
        </button>
        <button
          disabled={!future.length}
          onClick={() => {
            const next = future.at(-1)!;
            setPast([...past, pose]);
            setFuture(future.slice(0, -1));
            setPose(next);
            applyPose(rig, next);
          }}
        >
          重做姿势
        </button>
        <button onClick={() => commit({})}>重置 3D 姿势</button>
      </div>
      <p className="warning">
        姿势暂不保存；刷新、切换素体或返回 2D 将清除本次 3D 编辑。IK 和关节限制尚未接入。
      </p>
    </section>
  );
}
