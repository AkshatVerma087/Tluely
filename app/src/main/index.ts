// Main process entry point and composition root (D-023).
//
// This is the only place where services are created and connected. Each service is built by a
// createXService(deps) factory that receives what it needs as arguments, so dependencies are
// visible here and services can be tested with fakes.
//
// Startup order: security rules -> state store -> services -> IPC command handlers -> first window.

import { app } from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { createStateStore } from './store'
import { DEFAULT_SETTINGS, createInitialState } from './store/defaults'
import { createStealthService } from './stealth'
import { createWindowService } from './windows'
import { handleCommands } from './ipc'
import { applySecurityPolicies } from './security'

app.whenReady().then(() => {
  // Windows uses this id to group the app's windows and notifications.
  electronApp.setAppUserModelId('com.tluely.app')

  // F12 opens DevTools in dev; Ctrl+R reload is disabled in production.
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // 0. Security rules for every page, before any window exists (D-011).
  applySecurityPolicies()

  // 1. State: the single source of truth (D-022).
  //    Settings come from defaults until settings.json loading exists (Phase 2.1).
  //    No API keys are stored yet (Phase 2.1).
  const store = createStateStore(
    createInitialState(DEFAULT_SETTINGS, { groq: false, anthropic: false })
  )

  // 2. Services. More are added here phase by phase (hotkeys, ai, session, ...).
  //    Stealth comes first: the window service hands it every overlay it creates.
  const stealth = createStealthService({ store })
  const windows = createWindowService({ store, stealth })

  // 3. Commands the windows can call through window.tluely.invoke(...) (D-021).
  const disposeCommands = handleCommands({
    // Health check used to verify the IPC round trip.
    ping: () => 'pong',
    // Lets a window read the full state when it first loads.
    'state:get': () => store.get(),
    // Toggles invisible mode. The store notifies subscribers, so windows get 'state:changed'.
    'invisible:set': (invisible) => {
      store.update((s) => (s.invisible === invisible ? s : { ...s, invisible }))
    },
    // The answer panel reports its content height; the window service clamps and applies it.
    'window:resizePanel': (contentHeight) => windows.resizeAnswerPanel(contentHeight),
    // Quit the app (control bar button now, tray menu in Phase 1.4).
    // Overlays are closable:false, so quitting goes through app.quit(), not by closing windows.
    'app:quit': () => app.quit()
  })

  // 4. Show the UI: the overlays (control bar + answer panel below it).
  windows.openControlBar()
  windows.openAnswerPanel()

  // Quitting: destroy the overlays first. They are closable:false, so app.quit()'s attempt to
  // close them would be refused and cancel the quit (found in the 1.1 click test).
  app.on('before-quit', () => windows.destroyOverlays())

  // Clean up subscriptions and handlers once the app is really quitting.
  app.on('will-quit', () => {
    disposeCommands()
    windows.dispose()
    stealth.dispose()
  })
})

// Windows-only app: quit when the last window closes.
app.on('window-all-closed', () => {
  app.quit()
})
