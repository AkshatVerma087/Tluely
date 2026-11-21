// Unit tests for the stealth service and its protection rule (src/main/stealth, FINDINGS.md 3.1).
// They run in plain Node: windows are fake objects that record setContentProtection calls,
// and the store is the real one from store/state.ts.

import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { createStateStore } from '../store'
import { DEFAULT_SETTINGS, createInitialState } from '../store/defaults'
import { SHOW_REVEAL_DELAY_MS, createStealthService, shouldProtect, type StealthWindow } from '.'

/** A store starting with the given invisible/capturing flags. */
function makeStore(invisible: boolean, capturing = false): ReturnType<typeof createStateStore> {
  const initial = createInitialState(DEFAULT_SETTINGS, { groq: false, anthropic: false })
  return createStateStore({ ...initial, invisible, capturing })
}

/**
 * A fake window. Its methods are spies, so tests can check the calls (and their order).
 * `close()` simulates the user/app closing it: it becomes destroyed and fires 'closed'.
 */
function makeWindow(): StealthWindow & {
  setContentProtection: Mock<(enable: boolean) => void>
  setOpacity: Mock<(opacity: number) => void>
  showInactive: Mock<() => void>
  close(): void
} {
  let destroyed = false
  let onClosed: (() => void) | null = null
  return {
    // Typed spies, so they match the StealthWindow method signatures.
    setContentProtection: vi.fn<(enable: boolean) => void>(),
    setOpacity: vi.fn<(opacity: number) => void>(),
    showInactive: vi.fn<() => void>(),
    isDestroyed: () => destroyed,
    once: (_event, listener) => {
      onClosed = listener
    },
    close() {
      destroyed = true
      onClosed?.()
    }
  }
}

describe('shouldProtect', () => {
  // The full truth table of "invisible || capturing".
  it.each([
    [false, false, false],
    [true, false, true],
    [false, true, true],
    [true, true, true]
  ])('invisible=%s capturing=%s -> %s', (invisible, capturing, expected) => {
    expect(shouldProtect({ invisible, capturing })).toBe(expected)
  })
})

describe('createStealthService', () => {
  // A new window gets the current value immediately (before it is shown), whether on or off.
  it('applies the current protection as soon as a window is registered', () => {
    const on = makeWindow()
    createStealthService({ store: makeStore(true) }).protect(on)
    expect(on.setContentProtection).toHaveBeenCalledExactlyOnceWith(true)

    const off = makeWindow()
    createStealthService({ store: makeStore(false) }).protect(off)
    expect(off.setContentProtection).toHaveBeenCalledExactlyOnceWith(false)
  })

  // Toggling invisible mode updates every registered window.
  it('re-applies protection to all windows when invisible changes', () => {
    const store = makeStore(true)
    const stealth = createStealthService({ store })
    const bar = makeWindow()
    const panel = makeWindow()
    stealth.protect(bar)
    stealth.protect(panel)

    store.update((s) => ({ ...s, invisible: false }))

    expect(bar.setContentProtection).toHaveBeenLastCalledWith(false)
    expect(panel.setContentProtection).toHaveBeenLastCalledWith(false)
  })

  // The screenshot case: invisible is off, but while capturing the overlay must be protected,
  // and afterwards it goes back to unprotected.
  it('protects while capturing even when invisible is off', () => {
    const store = makeStore(false)
    const stealth = createStealthService({ store })
    const window = makeWindow()
    stealth.protect(window)

    store.update((s) => ({ ...s, capturing: true }))
    expect(window.setContentProtection).toHaveBeenLastCalledWith(true)

    store.update((s) => ({ ...s, capturing: false }))
    expect(window.setContentProtection).toHaveBeenLastCalledWith(false)
  })

  // State changes that don't flip the result (e.g. capturing while already invisible, or an
  // unrelated field) must not call the Win32 API again.
  it('skips windows when the protection value does not change', () => {
    const store = makeStore(true)
    const stealth = createStealthService({ store })
    const window = makeWindow()
    stealth.protect(window)
    window.setContentProtection.mockClear()

    store.update((s) => ({ ...s, capturing: true }))
    store.update((s) => ({ ...s, keys: { ...s.keys, groq: true } }))

    expect(window.setContentProtection).not.toHaveBeenCalled()
  })

  // Registering the same window twice must not double-track it.
  it('ignores a window that is already protected', () => {
    const stealth = createStealthService({ store: makeStore(true) })
    const window = makeWindow()
    stealth.protect(window)
    stealth.protect(window)
    expect(window.setContentProtection).toHaveBeenCalledOnce()
  })

  // Closed windows are forgotten, so later changes never touch a destroyed BrowserWindow
  // (which would throw "Object has been destroyed" in Electron).
  it('forgets windows once they are closed', () => {
    const store = makeStore(true)
    const stealth = createStealthService({ store })
    const window = makeWindow()
    stealth.protect(window)
    window.close()
    window.setContentProtection.mockClear()

    store.update((s) => ({ ...s, invisible: false }))

    expect(window.setContentProtection).not.toHaveBeenCalled()
  })

  // After dispose(), state changes no longer reach the windows.
  it('stops reacting after dispose', () => {
    const store = makeStore(true)
    const stealth = createStealthService({ store })
    const window = makeWindow()
    stealth.protect(window)
    stealth.dispose()
    window.setContentProtection.mockClear()

    store.update((s) => ({ ...s, invisible: false }))

    expect(window.setContentProtection).not.toHaveBeenCalled()
  })
})

// The opacity-0 show trick (FINDINGS.md section 4). Fake timers let the tests step through the
// 30 ms delay without really waiting: vi.advanceTimersByTime(ms) runs timers due in that time.
describe('stealth show', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  // The core sequence: protection first, then opacity 0, then showInactive, and opacity 1
  // only once the delay has passed.
  it('shows at opacity 0 and reveals after the delay', () => {
    const stealth = createStealthService({ store: makeStore(true) })
    const window = makeWindow()

    stealth.show(window)

    // invocationCallOrder is a global counter of spy calls, so it proves the order of the calls.
    const [protectedAt] = window.setContentProtection.mock.invocationCallOrder
    const [hiddenAt] = window.setOpacity.mock.invocationCallOrder
    const [shownAt] = window.showInactive.mock.invocationCallOrder
    expect(window.setContentProtection).toHaveBeenCalledWith(true)
    expect(window.setOpacity).toHaveBeenCalledExactlyOnceWith(0)
    expect(protectedAt).toBeLessThan(hiddenAt)
    expect(hiddenAt).toBeLessThan(shownAt)

    // Just before the delay ends: still transparent.
    vi.advanceTimersByTime(SHOW_REVEAL_DELAY_MS - 1)
    expect(window.setOpacity).toHaveBeenCalledTimes(1)

    // Delay reached: revealed.
    vi.advanceTimersByTime(1)
    expect(window.setOpacity).toHaveBeenLastCalledWith(1)
  })

  // Showing twice in a row restarts the timer, so the window is revealed exactly once.
  it('restarts the reveal when shown again before it fired', () => {
    const stealth = createStealthService({ store: makeStore(true) })
    const window = makeWindow()

    stealth.show(window)
    vi.advanceTimersByTime(SHOW_REVEAL_DELAY_MS - 10)
    stealth.show(window)
    vi.advanceTimersByTime(SHOW_REVEAL_DELAY_MS)

    const reveals = window.setOpacity.mock.calls.filter(([opacity]) => opacity === 1)
    expect(reveals).toHaveLength(1)
  })

  // Closing the window during the 30 ms must not lead to setOpacity on a destroyed window
  // (Electron would throw "Object has been destroyed").
  it('does not reveal a window that was closed during the delay', () => {
    const stealth = createStealthService({ store: makeStore(true) })
    const window = makeWindow()

    stealth.show(window)
    window.close()
    vi.advanceTimersByTime(SHOW_REVEAL_DELAY_MS)

    expect(window.setOpacity).not.toHaveBeenCalledWith(1)
  })

  // A destroyed window is ignored completely.
  it('ignores a destroyed window', () => {
    const stealth = createStealthService({ store: makeStore(true) })
    const window = makeWindow()
    window.close()

    stealth.show(window)

    expect(window.showInactive).not.toHaveBeenCalled()
  })

  // dispose() cancels reveals that are still pending.
  it('cancels pending reveals on dispose', () => {
    const stealth = createStealthService({ store: makeStore(true) })
    const window = makeWindow()

    stealth.show(window)
    stealth.dispose()
    vi.advanceTimersByTime(SHOW_REVEAL_DELAY_MS)

    expect(window.setOpacity).not.toHaveBeenCalledWith(1)
  })
})
