import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

type CameraState = {
  position: [number, number, number];
  target: [number, number, number];
  perspective: boolean;
  size: number;
};
const initial: CameraState = {
  position: [0, 1, 4],
  target: [0, 1, 0],
  perspective: false,
  size: 2.4,
};
type Runtime = {
  apply: (state: CameraState) => void;
  unlock: (value: boolean) => void;
  view: (name: string) => void;
  copy: () => CameraState;
};

export function Scene3D({ onLegacy }: { onLegacy: () => void }) {
  const freeHost = useRef<HTMLDivElement>(null);
  const captureHost = useRef<HTMLDivElement>(null);
  const runtime = useRef<Runtime | null>(null);
  const [camera, setCamera] = useState<CameraState>(initial);
  const [history, setHistory] = useState<CameraState[]>([]);
  const [locked, setLocked] = useState(true);
  const [status, setStatus] = useState('正在加载 3D 素体…');
  const [model, setModel] = useState('male');
  const current = useRef(camera);
  function commit(next: CameraState) {
    if (JSON.stringify(next) === JSON.stringify(current.current)) return;
    const before = structuredClone(current.current);
    setHistory((past) => [...past, before].slice(-100));
    current.current = next;
    setCamera(next);
    runtime.current?.apply(next);
  }
  const commitRef = useRef(commit);
  useEffect(() => {
    commitRef.current = commit;
  });
  useEffect(() => {
    runtime.current?.unlock(!locked);
  }, [locked]);
  useEffect(() => {
    const host = freeHost.current!;
    const output = captureHost.current!;
    let disposed = false;
    let request = 0;
    let freeRenderer!: THREE.WebGLRenderer;
    let captureRenderer: THREE.WebGLRenderer;
    try {
      freeRenderer = new THREE.WebGLRenderer({ antialias: true });
      captureRenderer = new THREE.WebGLRenderer({ antialias: true });
    } catch {
      freeRenderer?.dispose();
      queueMicrotask(() => {
        if (!disposed) setStatus('无法启用 WebGL，请使用支持硬件加速的浏览器。');
      });
      return;
    }
    freeRenderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    captureRenderer.setPixelRatio(1);
    captureRenderer.setSize(512, 512);
    host.appendChild(freeRenderer.domElement);
    output.appendChild(captureRenderer.domElement);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#202936');
    scene.add(new THREE.HemisphereLight(0xe7f0ff, 0x536071, 2.4));
    const light = new THREE.DirectionalLight(0xffffff, 3);
    light.position.set(3, 5, 4);
    scene.add(light);
    const rim = new THREE.DirectionalLight(0x8db9ff, 1.5);
    rim.position.set(-3, 3, -3);
    scene.add(rim);
    const grid = new THREE.GridHelper(10, 20, 0x637387, 0x364252);
    scene.add(grid);
    const free = new THREE.PerspectiveCamera(40, 1, 0.01, 100);
    free.position.set(3, 2, 4);
    const controls = new OrbitControls(free, freeRenderer.domElement);
    controls.target.set(0, 1, 0);
    controls.update();
    const ortho = new THREE.OrthographicCamera(-1.2, 1.2, 1.2, -1.2, 0.01, 100);
    const perspective = new THREE.PerspectiveCamera(40, 1, 0.01, 100);
    let capture: THREE.Camera = ortho;
    let captureControls = new OrbitControls(capture, captureRenderer.domElement);
    captureControls.enabled = false;
    let helper = new THREE.CameraHelper(ortho);
    scene.add(helper);
    function end() {
      commitRef.current({
        position: capture.position.toArray() as CameraState['position'],
        target: captureControls.target.toArray() as CameraState['target'],
        perspective: capture === perspective,
        size: current.current.size,
      });
    }
    captureControls.addEventListener('end', end);
    function apply(state: CameraState) {
      const next = state.perspective ? perspective : ortho;
      if (next !== capture) {
        const enabled = captureControls.enabled;
        captureControls.dispose();
        capture = next;
        captureControls = new OrbitControls(capture, captureRenderer.domElement);
        captureControls.enabled = enabled;
        captureControls.addEventListener('end', end);
        scene.remove(helper);
        helper.dispose();
        helper = new THREE.CameraHelper(next);
        scene.add(helper);
      }
      ortho.left = ortho.bottom = -state.size / 2;
      ortho.right = ortho.top = state.size / 2;
      ortho.updateProjectionMatrix();
      capture.position.fromArray(state.position);
      captureControls.target.fromArray(state.target);
      captureControls.update();
      helper.update();
    }
    runtime.current = {
      apply,
      unlock: (value) => {
        captureControls.enabled = value;
      },
      copy: () => ({
        position: free.position.toArray() as CameraState['position'],
        target: controls.target.toArray() as CameraState['target'],
        perspective: true,
        size: current.current.size,
      }),
      view: (name) => {
        const positions: Record<string, number[]> = {
          正面: [0, 1, 4],
          背面: [0, 1, -4],
          左侧: [4, 1, 0],
          右侧: [-4, 1, 0],
          顶部: [0, 5, 0.001],
          复位: [3, 2, 4],
        };
        free.position.fromArray(positions[name]);
        controls.target.set(0, 1, 0);
        controls.update();
      },
    };
    apply(current.current);
    const resize = new ResizeObserver(() => {
      const width = host.clientWidth,
        height = host.clientHeight;
      freeRenderer.setSize(width, height);
      free.aspect = width / Math.max(height, 1);
      free.updateProjectionMatrix();
    });
    resize.observe(host);
    function disposeModel(object: THREE.Object3D) {
      object.traverse((child) => {
        const mesh = child as THREE.Mesh;
        mesh.geometry?.dispose();
        if (mesh.material)
          for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material])
            material.dispose();
      });
    }
    new GLTFLoader().load(
      `/models/quaternius/mannequin-${model}.glb`,
      (gltf) => {
        if (disposed) {
          disposeModel(gltf.scene);
          return;
        }
        gltf.scene.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(gltf.scene);
        const group = new THREE.Group();
        group.add(gltf.scene);
        group.position.y = -box.min.y;
        scene.add(group);
        let joints = 0;
        gltf.scene.traverse((node) => {
          if ((node as THREE.Bone).isBone) joints++;
        });
        setStatus(`模型已加载 · ${joints} 个骨骼节点 · 静止姿态预览`);
      },
      undefined,
      () => {
        if (!disposed) setStatus('模型加载失败，请检查本地 GLB 文件。');
      },
    );
    function render() {
      helper.visible = true;
      grid.visible = true;
      helper.update();
      freeRenderer.render(scene, free);
      helper.visible = false;
      grid.visible = false;
      captureRenderer.render(scene, capture);
      request = requestAnimationFrame(render);
    }
    render();
    return () => {
      disposed = true;
      cancelAnimationFrame(request);
      resize.disconnect();
      controls.dispose();
      captureControls.dispose();
      helper.dispose();
      disposeModel(scene);
      freeRenderer.dispose();
      captureRenderer.dispose();
      freeRenderer.forceContextLoss();
      captureRenderer.forceContextLoss();
      freeRenderer.domElement.remove();
      captureRenderer.domElement.remove();
      runtime.current = null;
    };
  }, [model]);
  return (
    <main className="scene3d-shell">
      <header className="topbar">
        <strong>MotionForge · 3D 预览</strong>
        <span>D1 双摄像机</span>
        <button onClick={onLegacy}>打开原 2D 编辑器</button>
      </header>
      <div className="scene3d-toolbar">
        <label>
          素体{' '}
          <select
            aria-label="素体模型"
            value={model}
            onChange={(event) => {
              setLocked(true);
              setStatus('正在加载 3D 素体…');
              setModel(event.target.value);
            }}
          >
            <option value="male">男性</option>
            <option value="female">女性</option>
          </select>
        </label>
        {['正面', '背面', '左侧', '右侧', '顶部', '复位'].map((name) => (
          <button key={name} onClick={() => runtime.current?.view(name)}>
            {name}
          </button>
        ))}
      </div>
      <div className="scene3d-layout">
        <section className="scene3d-free">
          <h3>自由摄像机 · 左键环绕 / 右键平移 / 滚轮缩放</h3>
          <div ref={freeHost} data-testid="free-view" className="scene3d-host" />
        </section>
        <aside className="scene3d-settings">
          <h3>截图摄像机 · {locked ? '已锁定' : '调整中'}</h3>
          <div ref={captureHost} data-testid="capture-view" className="scene3d-capture" />
          <button aria-pressed={!locked} onClick={() => setLocked(!locked)}>
            {locked ? '解锁截图摄像机' : '锁定截图摄像机'}
          </button>
          <button
            disabled={locked}
            onClick={() => {
              const next = runtime.current?.copy();
              if (next) commit(next);
            }}
          >
            采用当前自由视角
          </button>
          <button
            disabled={!history.length}
            onClick={() => {
              const previous = history.at(-1)!;
              setHistory(history.slice(0, -1));
              current.current = previous;
              setCamera(previous);
              runtime.current?.apply(previous);
            }}
          >
            撤销相机调整
          </button>
          <fieldset disabled={locked}>
            <label>
              投影{' '}
              <select
                aria-label="截图投影"
                value={camera.perspective ? 'perspective' : 'orthographic'}
                onChange={(event) =>
                  commit({ ...camera, perspective: event.target.value === 'perspective' })
                }
              >
                <option value="orthographic">正交</option>
                <option value="perspective">透视（40°）</option>
              </select>
            </label>
            {(['position', 'target'] as const).map((field) => (
              <div key={field}>
                <p>{field === 'position' ? '世界位置' : '观察目标'}（米）</p>
                {camera[field].map((value, axis) => (
                  <label key={axis}>
                    {'XYZ'[axis]}{' '}
                    <input
                      aria-label={`${field}-${axis}`}
                      type="number"
                      step="0.1"
                      value={Number(value.toFixed(3))}
                      onChange={(event) => {
                        if (!event.target.value) return;
                        const number = Number(event.target.value);
                        if (!Number.isFinite(number) || Math.abs(number) > 100) return;
                        const tuple = [...camera[field]] as CameraState['position'];
                        tuple[axis] = number;
                        const next = { ...camera, [field]: tuple };
                        if (
                          new THREE.Vector3(...next.position).distanceTo(
                            new THREE.Vector3(...next.target),
                          ) > 0.01
                        )
                          commit(next);
                      }}
                    />
                  </label>
                ))}
              </div>
            ))}
            {!camera.perspective && (
              <label>
                视野高度{' '}
                <input
                  aria-label="正交视野高度"
                  type="number"
                  step="0.1"
                  min="0.2"
                  max="20"
                  value={camera.size}
                  onChange={(event) => {
                    const size = Number(event.target.value);
                    if (size >= 0.2 && size <= 20) commit({ ...camera, size });
                  }}
                />
              </label>
            )}
          </fieldset>
          <p>
            截图视图独立于自由摄像机，固定 1:1
            构图。当前为静止素体预览；姿势编辑、工程保存与正式截图导出将在后续接入。
          </p>
        </aside>
      </div>
      <footer className="statusbar" role="status">
        {status} · 本页相机设置暂不保存
      </footer>
    </main>
  );
}
