// Shared BrowserWindow options for overlay windows (D-025), based on FINDINGS.md section 4.
//
// Pure module: it only imports Electron *types*, so it is unit-testable without starting Electron.
// The factory (factory.ts) adds the secure webPreferences and actually creates the window.

import type { BrowserWindowConstructorOptions } from 'electron'
import type { WindowKind } from '@shared/windows'

/** The window kinds that are overlays (a subset of all window kinds, D-034). */
export type OverlayKind = Extract<WindowKind, 'control-bar' | 'answer-panel'>

/** Per-kind differences. Everything else is shared. */
export interface OverlaySpec {
  width: number
  /** Starting height, and the smallest the window may become. */
  height: number
  /** Largest height when growing with content. Equal to `height` for fixed-size windows. */
  maxHeight: number
  /** Whether the window may ever take keyboard focus. */
  focusable: boolean
}

export const OVERLAY_SPECS: Record<OverlayKind, OverlaySpec> = {
  // Small pill at the top of the screen. Only clicked, never typed into, so it never takes focus.
  'control-bar': { width: 200, height: 50, maxHeight: 50, focusable: false },
  // Answer area under the bar. Grows with content from 140 up to 500 px, then scrolls.
  // Focusable, because the user types questions into it (Phase 2.5).
  'answer-panel': { width: 540, height: 140, maxHeight: 500, focusable: true }
}

/**
 * Height a window of this kind should have for content of `contentHeight` px:
 * clamped between the spec's starting height and maxHeight, rounded up to whole pixels.
 * Invalid input (NaN, Infinity, negative) falls back to the starting height.
 */
export function clampOverlayHeight(kind: OverlayKind, contentHeight: number): number {
  const { height, maxHeight } = OVERLAY_SPECS[kind]
  if (!Number.isFinite(contentHeight) || contentHeight < 0) return height
  return Math.min(maxHeight, Math.max(height, Math.ceil(contentHeight)))
}

export interface OverlayOptionsInput {
  /** Settings 'noFocusWhenInvisible' && invisible: no overlay takes focus (FINDINGS.md section 4). */
  preventFocus: boolean
}

/**
 * Builds the window options for one overlay kind, without webPreferences (added by the factory).
 * Every stealth-related flag is set here so no overlay can forget one.
 */
export function overlayWindowOptions(
  kind: OverlayKind,
  { preventFocus }: OverlayOptionsInput
): Omit<BrowserWindowConstructorOptions, 'webPreferences'> {
  const spec = OVERLAY_SPECS[kind]

  return {
    width: spec.width,
    height: spec.height,
    title: 'tluely', // window title (hidden, but visible to window-listing tools)

    // Look: only our rounded UI is drawn; no frame, border, or shadow outline.
    frame: false,
    thickFrame: false, // Windows: no invisible resize border around frameless windows
    transparent: true,
    backgroundColor: '#00000000', // fully transparent background (ARGB)
    hasShadow: false,

    // Behaviour: floats above everything, hidden from the taskbar and Alt+Tab.
    alwaysOnTop: true,
    skipTaskbar: true,

    // Only the app controls these windows; the user can't resize, minimize, or close them.
    resizable: false,
    movable: false, // moved by hotkeys, not by dragging (Phase 1.3)
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    closable: false,

    // Focus: never steal focus from the meeting/exam page unless typing is needed.
    focusable: spec.focusable && !preventFocus,

    // Created hidden; the stealth service shows it without an unprotected flash (Phase 1.2).
    show: false
  }
}
