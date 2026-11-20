// Stealth service (D-023, D-025): keeps every overlay window's content protection in sync with the
// AppState (FINDINGS.md section 3).
//
// How it works:
// - The window service hands each new overlay to protect(window) right after creating it, BEFORE
//   it is shown. Protection is applied at once, so the window is never captured, not even for its
//   first frame.
// - The service subscribes to the store. On every state change it re-computes shouldProtect(state)
//   and, if the answer flipped, calls setContentProtection on every tracked window.
// - Destroyed windows are forgotten when they emit 'closed'.
//
// Still to come in Phase 1.2: the opacity-0 show trick and the "don't take focus" option.
//
// Windows are typed as the small ProtectableWindow interface instead of BrowserWindow, so the
// tests can pass plain fake objects and run without Electron.

import type { StateStore } from '../store'
import { shouldProtect } from './protection'

export { shouldProtect } from './protection'

/** The part of BrowserWindow this service uses. A real BrowserWindow satisfies it. */
export interface ProtectableWindow {
  setContentProtection(enable: boolean): void
  isDestroyed(): boolean
  once(event: 'closed', listener: () => void): unknown
}

export interface StealthServiceDeps {
  store: StateStore
}

export interface StealthService {
  /** Starts managing a window: applies the current protection now and on every later change. */
  protect(window: ProtectableWindow): void
  /** Stops listening to the store and forgets all windows (called on shutdown). */
  dispose(): void
}

export function createStealthService({ store }: StealthServiceDeps): StealthService {
  // The overlays we manage. A Set, so protecting the same window twice is harmless.
  const windows = new Set<ProtectableWindow>()

  // The value last applied to the windows. Used to skip redundant Win32 calls: the state changes
  // often (every transcript line, later), but protection only flips on invisible/capturing changes.
  let applied = shouldProtect(store.get())

  /** Applies a protection value to one window, skipping windows that are already destroyed. */
  function apply(window: ProtectableWindow, enable: boolean): void {
    if (window.isDestroyed()) {
      windows.delete(window)
      return
    }
    window.setContentProtection(enable)
  }

  // Re-evaluate on every state change (D-022).
  const unsubscribe = store.subscribe((next) => {
    const enable = shouldProtect(next)
    if (enable === applied) return
    applied = enable
    for (const window of [...windows]) apply(window, enable)
  })

  return {
    protect(window) {
      if (windows.has(window)) return
      windows.add(window)
      window.once('closed', () => windows.delete(window))
      // Apply right away, so a window created while invisible is protected before it's shown.
      apply(window, applied)
    },

    dispose() {
      unsubscribe()
      windows.clear()
    }
  }
}
