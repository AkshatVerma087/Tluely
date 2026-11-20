// Unit tests for the stealth service and its protection rule (src/main/stealth, FINDINGS.md 3.1).
// They run in plain Node: windows are fake objects that record setContentProtection calls,
// and the store is the real one from store/state.ts.

import { describe, expect, it, vi, type Mock } from 'vitest'
import { createStateStore } from '../store'
import { DEFAULT_SETTINGS, createInitialState } from '../store/defaults'
import { createStealthService, shouldProtect, type ProtectableWindow } from '.'

/** A store starting with the given invisible/capturing flags. */
function makeStore(invisible: boolean, capturing = false): ReturnType<typeof createStateStore> {
  const initial = createInitialState(DEFAULT_SETTINGS, { groq: false, anthropic: false })
  return createStateStore({ ...initial, invisible, capturing })
}

/**
 * A fake window. `setContentProtection` is a spy, so tests can check the calls.
 * `close()` simulates the user/app closing it: it becomes destroyed and fires 'closed'.
 */
function makeWindow(): ProtectableWindow & {
  setContentProtection: Mock<(enable: boolean) => void>
  close(): void
} {
  let destroyed = false
  let onClosed: (() => void) | null = null
  return {
    // Typed spy, so it matches ProtectableWindow's (enable: boolean) => void signature.
    setContentProtection: vi.fn<(enable: boolean) => void>(),
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
