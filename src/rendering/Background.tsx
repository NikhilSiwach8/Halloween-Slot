import { Component, Suspense, lazy, type ReactNode } from 'react';
import type { SceneProps } from './ClocktowerScene';
import { BACKGROUND_IMAGE, assetUrl } from './assetManifest';

const ClocktowerScene = lazy(() => import('./ClocktowerScene'));

class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

/** Environment layer: procedural 3D clocktower (lazy-loaded) over a CSS fallback. Purely decorative. */
export function Background(props: SceneProps & { enabled: boolean }) {
  const use3d = props.enabled && webglAvailable();
  return (
    <div className={`background mode-${props.mode.toLowerCase()} debt-${props.debtState.toLowerCase()}${props.splitting ? ' splitting' : ''}`} aria-hidden="true">
      {BACKGROUND_IMAGE && <img className="background-plate" src={assetUrl(BACKGROUND_IMAGE)} alt="" />}
      {use3d && (
        <SceneBoundary>
          <Suspense fallback={null}>
            <ClocktowerScene {...props} />
          </Suspense>
        </SceneBoundary>
      )}
      <div className="fog fog-a" />
      <div className="fog fog-b" />
      <div className="vignette" />
    </div>
  );
}
