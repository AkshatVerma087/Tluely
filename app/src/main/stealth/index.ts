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
// - show(window) is the only way overlays are made visible: the opacity-0 show trick
//   (FINDINGS.md section 4). The window is shown fully transparent and faded in 30 ms later, so its
//   first painted frame can't be seen (or captured) before content protection has taken effect.
//
// Still to come in Phase 1.2: the "don't take focus" option.
//
// Windows are typed as small interfaces (ProtectableWindow, StealthWindow) instead of
// BrowserWindow, so the tests can pass plain fake objects and run without Electron.

import type { StateStore } from '../store'
import { shouldProtect } from './protection'

export { shouldProtect } from './protection'

/** How long a newly shown window stays at opacity 0 before it is revealed (Cluely uses 30 ms). */
export const SHOW_REVEAL_DELAY_MS = 30

/** The part of BrowserWindow that protect() uses. A real BrowserWindow satisfies it. */
export interface ProtectableWindow {
  setContentProtection(enable: boolean): void
  isDestroyed(): boolean
  once(event: 'closed', listener: () => void): unknown
}

/** The part of BrowserWindow that show() uses (adds opacity and showing). */
export interface StealthWindow extends ProtectableWindow {
  setOpacity(opacity: number): void
  showInactive(): void
}

export interface StealthServiceDeps {
  store: StateStore
}

export interface StealthService {
  /** Starts managing a window: applies the current protection now and on every later change. */
  protect(window: ProtectableWindow): void
  /**
   * Shows a window with the opacity-0 trick: opacity 0 -> showInactive() -> opacity 1 after
   * SHOW_REVEAL_DELAY_MS. Uses showInactive so the meeting app keeps keyboard focus.
   * Also protects the window, in case protect() wasn't called yet.
   */
  show(window: StealthWindow): void
  /** Stops listening to the store, cancels pending reveals and forgets all windows (shutdown). */
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

  // Reveal timers that haven't fired yet, per window. Showing a window again restarts its timer,
  // and closing it cancels the timer, so we never call setOpacity on a destroyed window.
  const pendingReveals = new Map<ProtectableWindow, ReturnType<typeof setTimeout>>()

  function cancelReveal(window: ProtectableWindow): void {
    const timer = pendingReveals.get(window)
    if (timer === undefined) return
    clearTimeout(timer)
    pendingReveals.delete(window)
  }

  function protect(window: ProtectableWindow): void {
    if (windows.has(window)) return
    windows.add(window)
    window.once('closed', () => {
      windows.delete(window)
      cancelReveal(window)
    })
    // Apply right away, so a window created while invisible is protected before it's shown.
    apply(window, applied)
  }

  function show(window: StealthWindow): void {
    if (window.isDestroyed()) return
    protect(window) // no-op if already protected
    cancelReveal(window)

    // 1. Fully transparent, 2. on screen without taking focus, 3. revealed shortly after.
    window.setOpacity(0)
    window.showInactive()
    pendingReveals.set(
      window,
      setTimeout(() => {
        pendingReveals.delete(window)
        if (!window.isDestroyed()) window.setOpacity(1)
      }, SHOW_REVEAL_DELAY_MS)
    )
  }

  return {
    protect,
    show,

    dispose() {
      unsubscribe()
      for (const window of [...pendingReveals.keys()]) cancelReveal(window)
      windows.clear()
    }
  }
}
