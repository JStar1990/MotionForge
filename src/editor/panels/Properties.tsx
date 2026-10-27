import { useState } from 'react';
import { usePoseEditor } from '../state/usePoseEditor';
import { useUIStore } from '../state/uiStore';
import { syncFKControls } from '../state/poseEdits';
import { setChainMode } from '../../core/rig/controls';
import { dragBoneEndpoint } from '../../core/rig/dragPose';
import { forwardKinematics } from '../../core/rig/fk';
import { setJointLimit } from '../../core/project/jointLimits';
import { rigForPose } from '../../core/rig/bodyTurn';

function NumberField({
  label,
  value,
  onCommit,
  min = -100000,
  max = 100000,
  unit = '',
}: {
  label: string;
  value: number;
  onCommit: (value: number) => void;
  min?: number;
  max?: number;
  unit?: string;
}) {
  const [text, setText] = useState<string | null>(null);
  function commit() {
    const next = text === null ? value : Number(text);
    if (text?.trim() && Number.isFinite(next) && next >= min && next <= max) onCommit(next);
    setText(null);
  }
  return (
    <label className="field">
      <span>{label}</span>
      <div className="number-wrap">
        <input
          aria-label={label}
          type="number"
          min={min}
          max={max}
          step="any"
          value={text ?? Number(value.toFixed(3))}
          onChange={(event) => setText(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur();
            if (event.key === 'Escape') {
              setText(null);
            }
          }}
        />
        <small>{unit}</small>
      </div>
    </label>
  );
}

export function Properties() {
  const { project, dispatch, dispatchProject, locked, key } = usePoseEditor();
  const { selectedBoneId, previewPose } = useUIStore();
  const bone = project.rig.bones.find((item) => item.id === selectedBoneId);
  const pose = previewPose ?? project.draft;
  const displayBone = rigForPose(project.rig, pose).bones.find((item) => item.id === bone?.id);
  const chain = project.rig.ikChains.find(
    (item) => item.upperBoneId === bone?.id || item.lowerBoneId === bone?.id,
  );
  const endpoint = chain ? forwardKinematics(project.rig, pose)[chain.lowerBoneId].end : null;
  const error =
    chain && endpoint
      ? Math.hypot(
          endpoint.x - pose.ikControls[chain.id].target.x,
          endpoint.y - pose.ikControls[chain.id].target.y,
        )
      : 0;
  return (
    <aside className="properties panel">
      <div className="panel-title">
        属性<span className="muted">{bone ? '骨骼' : key ? '关键姿势' : '草稿'}</span>
      </div>
      <fieldset
        className="property-section property-fields"
        disabled={locked || previewPose !== null}
      >
        <h3>身体朝向</h3>
        <div className="control-buttons">
          {(
            [
              [-90, '朝左侧身'],
              [0, '正面'],
              [90, '朝右侧身'],
            ] as const
          ).map(([turn, label]) => (
            <button
              key={turn}
              aria-pressed={pose.bodyTurn === turn}
              onClick={() =>
                dispatch({
                  label: `身体朝向：${label}`,
                  apply: (draft) => {
                    draft.draft.bodyTurn = turn;
                    syncFKControls(draft, draft.draft);
                  },
                })
              }
            >
              {label}
            </button>
          ))}
        </div>
        <NumberField
          label="转身角度"
          value={pose.bodyTurn}
          min={-90}
          max={90}
          unit="°"
          onCommit={(value) =>
            dispatch({
              label: '调整转身角度',
              apply: (draft) => {
                draft.draft.bodyTurn = value;
                syncFKControls(draft, draft.draft);
              },
            })
          }
        />
        <p className="muted">0° 为正面，±90° 为侧身。仅调整当前姿势，肩髋随转身收窄。</p>
      </fieldset>
      <div className="property-section">
        <div className="eyebrow">{bone ? 'BONE TRANSFORM' : 'POSE TRANSFORM'}</div>
        <h2>{bone?.name ?? '根节点'}</h2>
        <p className="muted">{bone ? '调整相对静止姿势的局部旋转' : '角色在项目画布中的位置'}</p>
      </div>
      <fieldset
        disabled={locked || previewPose !== null}
        className="property-section property-fields"
        key={bone?.id ?? 'root'}
      >
        {bone ? (
          <>
            <NumberField
              label="局部旋转"
              value={(pose.localRotations[bone.id] * 180) / Math.PI}
              min={((bone.angleLimit?.min ?? -Math.PI * 2) * 180) / Math.PI}
              max={((bone.angleLimit?.max ?? Math.PI * 2) * 180) / Math.PI}
              unit="°"
              onCommit={(value) =>
                dispatch({
                  label: `旋转${bone.name}`,
                  apply: (draft) => {
                    draft.draft.localRotations[bone.id] = (value * Math.PI) / 180;
                    syncFKControls(draft, draft.draft);
                  },
                })
              }
            />
            <div className="readout">
              <span>骨段长度</span>
              <span>{bone.length} px</span>
            </div>
            <div className="readout">
              <span>静止角度</span>
              <span>
                {Math.round(((displayBone?.restAngle ?? bone.restAngle) * 180) / Math.PI)}°
              </span>
            </div>
            <div className="readout">
              <span>控制方式</span>
              <span>{chain ? pose.ikControls[chain.id].mode.toUpperCase() : 'FK'}</span>
            </div>
            {chain && (
              <>
                <div className="control-buttons">
                  {(['ik', 'fk'] as const).map((mode) => (
                    <button
                      key={mode}
                      aria-pressed={pose.ikControls[chain.id].mode === mode}
                      onClick={() =>
                        dispatch({
                          label: `切换 ${mode.toUpperCase()}`,
                          apply: (draft) => {
                            draft.draft = setChainMode(draft.rig, draft.draft, chain, mode);
                          },
                        })
                      }
                    >
                      {mode.toUpperCase()}
                    </button>
                  ))}
                </div>
                <button
                  disabled={pose.ikControls[chain.id].mode !== 'ik'}
                  onClick={() =>
                    dispatch({
                      label: '翻转弯曲方向',
                      apply: (draft) => {
                        const control = draft.draft.ikControls[chain.id];
                        draft.draft = dragBoneEndpoint(
                          draft.rig,
                          draft.draft,
                          chain.lowerBoneId,
                          control.target,
                          { bendSign: control.bendSign === 1 ? -1 : 1 },
                        ).pose;
                      },
                    })
                  }
                >
                  翻转弯曲方向
                </button>
                <div className="readout">
                  <span>目标偏差</span>
                  <output aria-label="目标偏差">{error.toFixed(2)} px</output>
                </div>
                {error > 0.5 && (
                  <p className="warning">目标不可达或受关节角度限制，骨长保持不变。</p>
                )}
              </>
            )}
            {chain && (
              <div className="joint-limits">
                <label>
                  <input
                    type="checkbox"
                    aria-label="启用关节限制"
                    checked={!!bone.angleLimit}
                    onChange={(event) =>
                      dispatchProject({
                        label: '设置关节限制',
                        apply: (draft) =>
                          setJointLimit(
                            draft,
                            bone.id,
                            event.target.checked ? { min: -Math.PI, max: Math.PI } : undefined,
                          ),
                      })
                    }
                  />
                  启用关节限制
                </label>
                {bone.angleLimit && (
                  <>
                    <NumberField
                      label="最小角度"
                      unit="°"
                      min={-360}
                      max={(bone.angleLimit.max * 180) / Math.PI}
                      value={(bone.angleLimit.min * 180) / Math.PI}
                      onCommit={(value) =>
                        dispatchProject({
                          label: '设置最小角度',
                          apply: (draft) =>
                            setJointLimit(draft, bone.id, {
                              min: (value * Math.PI) / 180,
                              max: bone.angleLimit!.max,
                            }),
                        })
                      }
                    />
                    <NumberField
                      label="最大角度"
                      unit="°"
                      min={(bone.angleLimit.min * 180) / Math.PI}
                      max={360}
                      value={(bone.angleLimit.max * 180) / Math.PI}
                      onCommit={(value) =>
                        dispatchProject({
                          label: '设置最大角度',
                          apply: (draft) =>
                            setJointLimit(draft, bone.id, {
                              min: bone.angleLimit!.min,
                              max: (value * Math.PI) / 180,
                            }),
                        })
                      }
                    />
                    <p className="muted">项目级设置：超出范围的姿势将同步调整，可整体撤销。</p>
                  </>
                )}
              </div>
            )}
          </>
        ) : (
          <>
            {(['x', 'y'] as const).map((axis) => (
              <NumberField
                key={axis}
                label={`位置 ${axis.toUpperCase()}`}
                value={pose.rootPosition[axis]}
                unit="px"
                onCommit={(value) =>
                  dispatch({
                    label: '移动根节点',
                    apply: (draft) => {
                      draft.draft.rootPosition[axis] = value;
                      syncFKControls(draft, draft.draft);
                    },
                  })
                }
              />
            ))}
            <NumberField
              label="整体旋转"
              value={(pose.rootRotation * 180) / Math.PI}
              min={-360}
              max={360}
              unit="°"
              onCommit={(value) =>
                dispatch({
                  label: '旋转根节点',
                  apply: (draft) => {
                    draft.draft.rootRotation = (value * Math.PI) / 180;
                    syncFKControls(draft, draft.draft);
                  },
                })
              }
            />
          </>
        )}
      </fieldset>
      <div className="property-section">
        <h3>工程设置</h3>
        <div className="readout">
          <span>画布尺寸</span>
          <span>
            {project.canvas.width} × {project.canvas.height}
          </span>
        </div>
        <div className="readout">
          <span>帧率</span>
          <span>{project.fps} FPS</span>
        </div>
        <div className="readout">
          <span>默认持续</span>
          <span>{project.defaultDurationFrames} 帧</span>
        </div>
        <div className="readout">
          <span>播放方式</span>
          <span>保持姿势</span>
        </div>
      </div>
      <div className="panel-note warning">
        编辑提交后自动保存到本机
        <br />
        跨浏览器或清理数据前，请下载工程备份。
      </div>
    </aside>
  );
}
