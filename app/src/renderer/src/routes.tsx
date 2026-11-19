// Route table: which UI each window kind renders (D-034).
//
// - Typed as Record<WindowKind, ...>, so adding a window kind without a route is a type error.
// - Each route is lazy-loaded (React.lazy), so a window only downloads its own UI's code:
//   the control bar never loads the Settings page, and the audio worker's heavy VAD code (Phase 3)
//   stays out of the overlays.

import { lazy, type ComponentType, type LazyExoticComponent } from 'react'
import type { WindowKind } from '@shared/windows'

export const ROUTES: Record<WindowKind, LazyExoticComponent<ComponentType>> = {
  // Overlays (Phase 1.1).
  'control-bar': lazy(() => import('./control-bar').then((m) => ({ default: m.ControlBar }))),
  'answer-panel': lazy(() => import('./answer-panel').then((m) => ({ default: m.AnswerPanel }))),
  // Placeholders until their phases: Settings (1.4), audio worker (3.2).
  settings: lazy(() => import('./settings').then((m) => ({ default: m.Settings }))),
  'audio-worker': lazy(() => import('./audio-worker').then((m) => ({ default: m.AudioWorker })))
}
