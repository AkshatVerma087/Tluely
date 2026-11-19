import type { TluelyApi } from '@shared/ipc'

// Tells TypeScript in the renderer that `window.tluely` exists (exposed by src/preload/index.ts).
declare global {
  interface Window {
    tluely: TluelyApi
  }
}
