/** Decides whether to run the real-time hero scene, a static single-frame render, or the SVG fallback. */
export type SceneMode = 'animated' | 'static' | 'fallback';

export function detectSceneMode(): SceneMode {
  if (typeof window === 'undefined') return 'fallback';
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return 'fallback';
  } catch {
    return 'fallback';
  }
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  const lowPower = (nav.hardwareConcurrency ?? 8) <= 2 || (nav.deviceMemory ?? 8) <= 2 || nav.connection?.saveData === true;
  if (lowPower) return 'fallback';
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return 'static';
  return 'animated';
}
