// Overlay window factory (D-025): the only way overlay windows are created.
//
// Combines the shared stealth options (overlay-options.ts) with the secure webPreferences (D-011),
// sets the always-on-top level, and loads the renderer page for this kind (D-034).
// The window is returned hidden; showing it is the stealth service's job (Phase 1.2).

import { BrowserWindow } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import type { WindowKind } from '@shared/windows'
import { secureWebPreferences } from '../security'
import { overlayWindowOptions, type OverlayKind, type OverlayOptionsInput } from './overlay-options'

export type { OverlayKind } from './overlay-options'

export interface CreateOverlayOptions extends OverlayOptionsInput {
  /**
   * Owner window. Windows leaves owned windows out of Alt+Tab and the taskbar, which focusable
   * overlays need, because skipTaskbar alone doesn't remove them from Alt+Tab (D-025).
   * Owned windows also always stay above their owner.
   */
  parent?: BrowserWindow
}

/** Creates one hidden overlay window of the given kind and starts loading its page. */
export function createOverlayWindow(
  kind: OverlayKind,
  options: CreateOverlayOptions
): BrowserWindow {
  const window = new BrowserWindow({
    ...overlayWindowOptions(kind, options),
    parent: options.parent,
    webPreferences: secureWebPreferences()
  })

  // 'screen-saver' is the highest always-on-top level, so the overlay also stays above
  // full-screen browsers and presentations.
  window.setAlwaysOnTop(true, 'screen-saver')

  // Hide from the Windows taskbar again in case focus changes reset it (FINDINGS.md section 4).
  window.setSkipTaskbar(true)

  loadRenderer(window, kind)
  return window
}

/**
 * Loads the shared renderer page with `?window=<kind>`, so React knows which UI to show (D-034).
 * Dev: from the Vite dev server (hot reload). Prod: from the built file.
 */
export function loadRenderer(window: BrowserWindow, kind: WindowKind): void {
  const query = { window: kind }

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    const url = new URL(process.env['ELECTRON_RENDERER_URL'])
    url.searchParams.set('window', kind)
    void window.loadURL(url.toString())
  } else {
    void window.loadFile(join(__dirname, '../renderer/index.html'), { query })
  }
}
