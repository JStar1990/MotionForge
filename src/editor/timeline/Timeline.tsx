import { useRef, useState } from 'react';
import { keyIntervals } from '../../core/animation/frames';
import { insertKey, reorderKey, resizeKey } from '../../core/animation/editing';
import { savePose } from '../../core/project/poseAssets';
import { useProjectStore } from '../state/projectStore';
import { usePlaybackStore } from '../state/playbackStore';
import { useUIStore } from '../state/uiStore';
import { useTransport } from './useTransport';

export function Timeline() {
  useTransport();
  const { project, dispatch } = useProjectStore();
  const transport = usePlaybackStore();
  const dragging = useUIStore((state) => state.previewPose !== null);
  const [resize, setResize] = useState<{
    id: string;
    startX: number;
    original: number;
    duration: number;
  } | null>(null);
  const moving = useRef<string | null>(null);
  const clip = project.clips.find((item) => item.id === transport.clipId);
  const intervals = clip ? keyIntervals(clip) : [];
  const total = intervals.at(-1)?.end ?? 0;
  const current = intervals.find(
    (item) => transport.frame >= item.start && transport.frame < item.end,
  );
  const locked = dragging || transport.playing || !!resize;
  const pixel = 32;
  const full = !!clip && (clip.keys.length >= 300 || total >= 3000);
  function seek(frame: number) {
    transport.setFrame(Math.max(0, Math.min(total - 1, frame)));
  }
  function jump(delta: number) {
    const index = intervals.findIndex((item) => item.key.id === current?.key.id);
    seek(intervals[Math.max(0, Math.min(intervals.length - 1, index + delta))]?.start ?? 0);
  }
  return (
    <section className="timeline">
      <div className="timeline-toolbar">
        <strong>动作时间轴</strong>
        <select
          aria-label="编辑目标"
          disabled={locked}
          value={clip?.id ?? ''}
          onChange={(event) => transport.selectClip(event.target.value || null)}
        >
          <option value="">独立姿势草稿</option>
          {project.clips.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
        <button
          disabled={locked}
          onClick={() => {
            const id = crypto.randomUUID();
            dispatch({
              label: '新建动作',
              apply: (draft) => {
                draft.clips.push({ id, name: `动作 ${draft.clips.length + 1}`, keys: [] });
              },
            });
            transport.selectClip(id);
          }}
        >
          新建动作
        </button>
        {clip && (
          <>
            <input
              key={clip.id + clip.name}
              aria-label="动作名称"
              defaultValue={clip.name}
              disabled={locked}
              maxLength={80}
              onBlur={(event) => {
                const name = event.target.value.trim();
                if (!name) {
                  event.target.value = clip.name;
                  return;
                }
                dispatch({
                  label: '重命名动作',
                  apply: (draft) => {
                    draft.clips.find((item) => item.id === clip.id)!.name = name;
                  },
                });
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') event.currentTarget.blur();
              }}
            />
            <button
              disabled={locked}
              onClick={() =>
                dispatch({
                  label: '删除动作',
                  apply: (draft) => {
                    draft.clips = draft.clips.filter((item) => item.id !== clip.id);
                  },
                })
              }
            >
              删除动作
            </button>
          </>
        )}
        <span className="muted">
          {intervals.length} 个关键姿势 / {total} 个播放帧
        </span>
        <label>
          FPS{' '}
          <input
            aria-label="帧率"
            type="number"
            min={1}
            max={60}
            value={project.fps}
            disabled={dragging || !!resize}
            onChange={(event) => {
              const fps = Number(event.target.value);
              if (Number.isInteger(fps) && fps >= 1 && fps <= 60) {
                transport.pause();
                dispatch({
                  label: '调整帧率',
                  apply: (draft) => {
                    draft.fps = fps;
                  },
                });
              }
            }}
          />
        </label>
        <output aria-label="动作时长">{Number((total / project.fps).toFixed(3))} 秒</output>
      </div>
      <div className="timeline-toolbar timeline-controls">
        <button
          disabled={locked || !clip || full}
          onClick={() =>
            clip &&
            dispatch(
              insertKey(
                clip.id,
                current?.key.pose ?? project.draft,
                `关键姿势 ${clip.keys.length + 1}`,
                current?.key.id,
              ),
            )
          }
        >
          添加当前姿势
        </button>
        <button
          disabled={locked || !current || full}
          onClick={() => {
            if (!clip || !current) return;
            dispatch({
              label: '复制关键姿势',
              apply: (draft) => {
                const target = draft.clips.find((item) => item.id === clip.id)!;
                const copy = structuredClone(current.key);
                copy.id = crypto.randomUUID();
                copy.name += ' 副本';
                copy.durationFrames = Math.min(copy.durationFrames, 3000 - total);
                target.keys.splice(
                  target.keys.findIndex((item) => item.id === current.key.id) + 1,
                  0,
                  copy,
                );
              },
            });
          }}
        >
          复制关键姿势
        </button>
        <button
          disabled={locked || !current}
          onClick={() =>
            clip &&
            current &&
            dispatch({
              label: '删除关键姿势',
              apply: (draft) => {
                const target = draft.clips.find((item) => item.id === clip.id)!;
                target.keys = target.keys.filter((item) => item.id !== current.key.id);
              },
            })
          }
        >
          删除关键姿势
        </button>
        <button
          disabled={locked || !current}
          onClick={() => current && dispatch(savePose(current.key.name, current.key.pose))}
        >
          另存为姿势
        </button>
        {current && (
          <>
            <input
              key={current.key.id + current.key.name}
              aria-label="关键姿势名称"
              defaultValue={current.key.name}
              disabled={locked}
              maxLength={80}
              onBlur={(event) => {
                const name = event.target.value.trim();
                if (!name) {
                  event.target.value = current.key.name;
                  return;
                }
                dispatch({
                  label: '重命名关键姿势',
                  apply: (draft) => {
                    draft.clips
                      .find((item) => item.id === clip!.id)!
                      .keys.find((item) => item.id === current.key.id)!.name = name;
                  },
                });
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') event.currentTarget.blur();
              }}
            />
            <label>
              持续帧数{' '}
              <input
                aria-label="持续帧数"
                key={current.key.id + ':' + current.key.durationFrames}
                type="number"
                min={1}
                max={3000 - total + current.key.durationFrames}
                defaultValue={current.key.durationFrames}
                disabled={locked}
                onBlur={(event) => {
                  const value = Number(event.target.value);
                  if (event.target.value && Number.isInteger(value) && value > 0)
                    dispatch(resizeKey(clip!.id, current.key.id, value));
                  else event.target.value = String(current.key.durationFrames);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') event.currentTarget.blur();
                }}
              />
            </label>
          </>
        )}
        <div className="transport">
          <button aria-label="上一关键姿势" disabled={locked || !total} onClick={() => jump(-1)}>
            «
          </button>
          <button
            aria-label="上一帧"
            disabled={locked || !total}
            onClick={() => seek(transport.frame - 1)}
          >
            ‹
          </button>
          <button
            aria-label={transport.playing ? '暂停' : '播放'}
            disabled={dragging || !!resize || !total}
            onClick={() => {
              if (transport.playing) transport.pause();
              else
                usePlaybackStore.setState({
                  playing: true,
                  frame: transport.frame >= total - 1 ? 0 : transport.frame,
                });
            }}
          >
            {transport.playing ? 'Ⅱ' : '▶'}
          </button>
          <button
            aria-label="下一帧"
            disabled={locked || !total}
            onClick={() => seek(transport.frame + 1)}
          >
            ›
          </button>
          <button aria-label="下一关键姿势" disabled={locked || !total} onClick={() => jump(1)}>
            »
          </button>
          <label>
            <input
              type="checkbox"
              aria-label="循环播放"
              checked={transport.loop}
              onChange={(event) => {
                transport.pause();
                usePlaybackStore.setState({ loop: event.target.checked });
              }}
            />
            循环
          </label>
        </div>
      </div>
      {total ? (
        <div className="timeline-scroll">
          <div className="frame-track" style={{ width: total * pixel }}>
            <div
              className="frame-ruler"
              role="slider"
              aria-label="播放头"
              aria-valuemin={1}
              aria-valuemax={total}
              aria-valuenow={transport.frame + 1}
              tabIndex={0}
              onKeyDown={(event) => {
                if (!locked && ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
                  event.preventDefault();
                  seek(
                    event.key === 'Home'
                      ? 0
                      : event.key === 'End'
                        ? total - 1
                        : transport.frame + (event.key === 'ArrowRight' ? 1 : -1),
                  );
                }
              }}
              onPointerDown={(event) => {
                if (locked) return;
                event.currentTarget.setPointerCapture(event.pointerId);
                seek(
                  Math.floor(
                    (event.clientX - event.currentTarget.getBoundingClientRect().left) / pixel,
                  ),
                );
              }}
              onPointerMove={(event) => {
                if (event.currentTarget.hasPointerCapture(event.pointerId))
                  seek(
                    Math.floor(
                      (event.clientX - event.currentTarget.getBoundingClientRect().left) / pixel,
                    ),
                  );
              }}
              onPointerUp={(event) => {
                if (event.currentTarget.hasPointerCapture(event.pointerId))
                  event.currentTarget.releasePointerCapture(event.pointerId);
              }}
            >
              {Array.from({ length: total }, (_, i) => (
                <span key={i} style={{ width: pixel }}>
                  {i + 1}
                </span>
              ))}
            </div>
            <div className="key-track">
              {intervals.map(({ key, start, end }) => (
                <div
                  key={key.id}
                  className={`key-block ${current?.key.id === key.id ? 'active' : ''}`}
                  style={{
                    width: (resize?.id === key.id ? resize.duration : key.durationFrames) * pixel,
                  }}
                  draggable={!locked}
                  onDragStart={(event) => {
                    moving.current = key.id;
                    event.dataTransfer.setData('text/plain', key.id);
                  }}
                  onDragEnd={() => {
                    moving.current = null;
                  }}
                  onDragOver={(event) => {
                    if (!locked) event.preventDefault();
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    if (!locked && moving.current)
                      dispatch(reorderKey(clip!.id, moving.current, key.id));
                    moving.current = null;
                  }}
                >
                  <button
                    disabled={locked}
                    aria-label={`选择关键姿势 ${key.name}`}
                    title={`${key.name} · 第 ${start + 1}–${end} 帧`}
                    onClick={() => seek(start)}
                  >
                    {key.name}
                    <small>{key.durationFrames} 帧</small>
                  </button>
                  <div
                    role="separator"
                    aria-label={`调整 ${key.name} 时长`}
                    aria-orientation="vertical"
                    className="key-resize"
                    onPointerDown={(event) => {
                      if (locked) return;
                      event.preventDefault();
                      event.stopPropagation();
                      event.currentTarget.setPointerCapture(event.pointerId);
                      setResize({
                        id: key.id,
                        startX: event.clientX,
                        original: key.durationFrames,
                        duration: key.durationFrames,
                      });
                    }}
                    onPointerMove={(event) => {
                      if (resize?.id === key.id)
                        setResize({
                          ...resize,
                          duration: Math.max(
                            1,
                            Math.min(
                              3000 - total + resize.original,
                              resize.original + Math.round((event.clientX - resize.startX) / pixel),
                            ),
                          ),
                        });
                    }}
                    onPointerUp={(event) => {
                      if (resize) {
                        dispatch(resizeKey(clip!.id, key.id, resize.duration));
                        setResize(null);
                        event.currentTarget.releasePointerCapture(event.pointerId);
                      }
                    }}
                    onPointerCancel={() => setResize(null)}
                  />
                </div>
              ))}
            </div>
            <div className="playhead" style={{ left: transport.frame * pixel + pixel / 2 }} />
          </div>
        </div>
      ) : (
        <div className="timeline-empty">
          <span>
            {clip
              ? '空动作：添加当前姿势，或从姿势库插入。'
              : '选择或新建动作，开始编排关键姿势。草稿独立保留。'}
          </span>
        </div>
      )}
      <div className="timeline-bottom">
        <output aria-label="当前播放帧">
          {total ? `第 ${transport.frame + 1} / ${total} 帧` : '没有播放帧'}
        </output>
        <span>
          {transport.playing
            ? '播放中 · 骨架编辑已锁定'
            : current
              ? `编辑 ${current.key.name} 的整段姿势`
              : '保持式播放 · 不自动补间'}
        </span>
        <label>
          <input
            type="checkbox"
            aria-label="洋葱皮"
            checked={transport.onion}
            onChange={(event) => usePlaybackStore.setState({ onion: event.target.checked })}
          />
          洋葱皮
        </label>
        <input
          aria-label="洋葱皮透明度"
          type="range"
          min={0.05}
          max={0.6}
          step={0.05}
          value={transport.onionOpacity}
          onChange={(event) =>
            usePlaybackStore.setState({ onionOpacity: Number(event.target.value) })
          }
        />
        {full && <span>已达到 300 段或 3000 帧上限</span>}
      </div>
    </section>
  );
}
