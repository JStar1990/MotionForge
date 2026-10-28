import { lazy, Suspense, useState } from 'react';
import { App } from './App';
const Scene3D = lazy(() =>
  import('./scene3d/Scene3D').then((module) => ({ default: module.Scene3D })),
);
export function Workspace() {
  const [legacy, setLegacy] = useState(new URLSearchParams(location.search).get('editor') === '2d');
  return legacy ? (
    <>
      <button className="switch3d" onClick={() => setLegacy(false)}>
        进入 3D 预览
      </button>
      <App />
    </>
  ) : (
    <Suspense fallback={<p>正在加载 3D 视图…</p>}>
      <Scene3D onLegacy={() => setLegacy(true)} />
    </Suspense>
  );
}
