import { useCallback, useEffect, useState } from 'react';
import * as THREE from 'three';

import type { BoneInteraction } from './BoneInteraction';
export type BoneRig = {
  bones: Map<string, THREE.Bone>;
  rest: Map<string, THREE.Quaternion>;
  interaction?: BoneInteraction;
};
type Pose = Record<string, [number, number, number, number]>;
export const boneLabels: Record<string, string> = {
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
  const [mode, setMode] = useState<'rotate' | 'translate'>('rotate');
  const [feedback, setFeedback] = useState('');
  const [selected, select] = useState('upperarm_l');
  const [space, setSpace] = useState<'local' | 'world'>('local');
  const [showBones, setShowBones] = useState(true);
  const [pose, setPose] = useState<Pose>({});
  const [past, setPast] = useState<Pose[]>([]);
  const [future, setFuture] = useState<Pose[]>([]);
  const commit = useCallback(
    (next: Pose) => {
      if (JSON.stringify(next) === JSON.stringify(pose)) return;
      setPast([...past, structuredClone(pose)].slice(-100));
      setFuture([]);
      setPose(next);
      applyPose(rig, next);
    },
    [past, pose, rig],
  );
  useEffect(() => {
    const interaction = rig.interaction;
    if (!interaction) return;
    interaction.bind(select, (changes) => commit({ ...pose, ...changes }), setFeedback);
    return () => {
      interaction.bind();
    };
  }, [rig, commit, pose]);
  useEffect(() => {
    rig.interaction?.select(selected);
  }, [rig, selected]);
  useEffect(() => {
    rig.interaction?.setVisible(showBones);
  }, [rig, showBones]);
  useEffect(() => {
    rig.interaction?.setSpace(space);
  }, [rig, space]);
  useEffect(() => {
    rig.interaction?.setMode(mode);
  }, [rig, mode]);
  const rotation = new THREE.Euler().setFromQuaternion(
    new THREE.Quaternion(...(pose[selected] ?? [0, 0, 0, 1])),
    'XYZ',
  );
  return (
    <section className="fk-controls">
      <h3>骨骼姿势 · FK / IK</h3>
      <label>
        操作模式{' '}
        <select
          aria-label="骨骼操作模式"
          value={mode}
          onChange={(event) => setMode(event.target.value as 'rotate' | 'translate')}
        >
          <option value="rotate">旋转骨骼（FK）</option>
          <option value="translate">平移手脚（IK）</option>
        </select>
      </label>
      <p data-testid="bone-feedback">{feedback}</p>
      <label>
        <input
          type="checkbox"
          checked={showBones}
          onChange={(event) => setShowBones(event.target.checked)}
        />
        显示骨骼控制点
      </label>
      <p>
        旋转模式拖动彩色旋转环；平移模式选手或脚，拖动箭头或方块。Esc
        取消本次拖动，空白处拖动可环绕观察。
      </p>
      <p>重叠关节点可按住 Alt 点击轮换选择，骨架连线可透过素体查看。</p>
      <label>
        旋转轴{' '}
        <select
          aria-label="旋转轴空间"
          disabled={mode === 'translate'}
          value={space}
          onChange={(event) => setSpace(event.target.value as 'local' | 'world')}
        >
          <option value="local">局部轴（随骨骼）</option>
          <option value="world">世界轴（固定方向）</option>
        </select>
      </label>
      <button onClick={() => rig.interaction?.focus()}>聚焦选中骨骼</button>
      <p>相对绑定姿态的局部 XYZ 旋转（度）。按 Enter 或移开焦点提交。</p>
      <select
        aria-label="选择 3D 骨骼"
        value={selected}
        onChange={(event) => select(event.target.value)}
      >
        {[...rig.bones.keys()]
          .filter((name) => boneLabels[name])
          .map((name) => (
            <option key={name} value={name}>
              {boneLabels[name]}
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
        姿势暂不保存；刷新、切换素体或返回 2D 将清除本次 3D 编辑。手脚平移已接入基础
        IK；关节限制、肘膝方向控件与整人平移尚未接入。
      </p>
    </section>
  );
}
