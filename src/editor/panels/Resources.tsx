import { useProjectStore } from '../state/projectStore';
import { useUIStore } from '../state/uiStore';
import { PoseLibrary } from './PoseLibrary';

export function Resources() {
  const rig = useProjectStore((state) => state.project.rig);
  const { resourceTab, setTab, selectedBoneId, selectBone } = useUIStore();
  function depth(id: string): number {
    const parent = rig.bones.find((bone) => bone.id === id)?.parentId;
    return parent ? 1 + depth(parent) : 0;
  }
  return (
    <aside className="resources panel">
      <div className="panel-title">
        工程资源<span className="badge">M3</span>
      </div>
      <div className="tabs" role="tablist" aria-label="资源类型">
        {(
          [
            ['bones', '骨骼'],
            ['poses', '姿势库'],
            ['references', '参考图'],
          ] as const
        ).map(([tab, label]) => (
          <button
            key={tab}
            role="tab"
            aria-selected={resourceTab === tab}
            onClick={() => setTab(tab)}
          >
            {label}
          </button>
        ))}
      </div>
      {resourceTab === 'bones' ? (
        <>
          <div className="resource-caption">
            默认人体骨架 <span>{rig.bones.length} 根</span>
          </div>
          <div className="bone-tree">
            {rig.bones.map((bone) => (
              <button
                key={bone.id}
                className={`bone-row ${selectedBoneId === bone.id ? 'selected' : ''}`}
                style={{ paddingLeft: 14 + depth(bone.id) * 12 }}
                onClick={() => selectBone(bone.id)}
                aria-pressed={selectedBoneId === bone.id}
              >
                <span className={`bone-mark ${bone.side}`}>◇</span>
                {bone.name}
                <span className="bone-size">{bone.length}</span>
              </button>
            ))}
          </div>
          <div className="panel-note">
            左右以角色自身为准。
            <br />
            拖动大圆点调整手腕、脚踝 IK；其他末端点旋转骨段，金色点移动整个角色。
          </div>
        </>
      ) : resourceTab === 'poses' ? (
        <PoseLibrary />
      ) : (
        <div className="empty-state">
          <span className="empty-symbol">▱</span>
          <strong>还没有参考图片</strong>
          <p>本地参考图片将在 M4 开放。</p>
        </div>
      )}
    </aside>
  );
}
