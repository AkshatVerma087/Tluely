// Window service: creates the app's windows and keeps them in sync with the AppState.
//
// For now it creates one temporary window. Phase 1.1 replaces it with the overlay
// windows (control bar, answer panel) made by a shared factory (D-025).

import { BrowserWindow } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import type { StateStore } from '../store'
import { broadcast } from '../ipc'
import { secureWebPreferences } from '../security'

export interface WindowServiceDeps {
  store: StateStore
}

export interface WindowService {
  /** Creates and shows the temporary main window. */
  openMainWindow(): BrowserWindow
  /** Stops pushing state to windows (called on shutdown). */
  dispose(): void
}

export function createWindowService({ store }: WindowServiceDeps): WindowService {
  // Push every state change to all windows as 'state:changed' (D-022).
  const unsubscribe = store.subscribe((next) => broadcast('state:changed', next))

  function openMainWindow(): BrowserWindow {
    const window = new BrowserWindow({
      width: 900,
      height: 670,
      show: false, // shown on 'ready-to-show' to avoid a blank white flash
      autoHideMenuBar: true,
      // Sandboxed, isolated, no Node.js (D-011). Link and navigation rules are app-wide in security/.
      webPreferences: secureWebPreferences()
    })

    window.on('ready-to-show', () => window.show())

    // Dev: load from the Vite dev server (hot reload). Prod: load the built file.
    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
      window.loadURL(process.env['ELECTRON_RENDERER_URL'])
    } else {
      window.loadFile(join(__dirname, '../renderer/index.html'))
    }

    return window
  }

  return { openMainWindow, dispose: unsubscribe }
}
