// Unit tests for the AppState store (src/main/store/state.ts, D-022).
// They run in plain Node via Vitest. No Electron is needed, because the store has no Electron imports.

import { describe, expect, it, vi } from 'vitest'
import type { AppState } from '@shared/types'
import { createStateStore } from './state'

// Builds a fresh, valid AppState for each test.
// Each test gets its own object, so tests can't affect each other.
function makeState(): AppState {
  return {
    invisible: false,
    capturing: false,
    session: { status: 'idle', id: null, transcript: [], exchanges: [] },
    settings: {
      version: 1,
      provider: 'groq',
      models: { groq: 'test-model', anthropic: 'claude-opus-5-5' },
      language: null,
      customPrompt: '',
      invisibleByDefault: true,
      noFocusWhenInvisible: false,
      micDeviceId: null,
      // Hotkey values are placeholders here; real defaults are decided in Phase 1.3.
      hotkeys: {
        ask: 'CommandOrControl+Enter',
        toggleVisibility: 'CommandOrControl+\\',
        focusInput: 'CommandOrControl+Shift+Space',
        clear: 'CommandOrControl+R',
        toggleSession: 'CommandOrControl+Shift+S',
        moveUp: 'CommandOrControl+Up',
        moveDown: 'CommandOrControl+Down',
        moveLeft: 'CommandOrControl+Left',
        moveRight: 'CommandOrControl+Right',
        scrollUp: 'CommandOrControl+Shift+Up',
        scrollDown: 'CommandOrControl+Shift+Down'
      },
      openAtLogin: false
    },
    keys: { groq: false, anthropic: false }
  }
}

describe('createStateStore', () => {
  // get() must hand back exactly what the store was created with.
  it('returns the initial state', () => {
    const initial = makeState()
    expect(createStateStore(initial).get()).toBe(initial)
  })

  // The core behaviour: update() changes the state and tells subscribers,
  // passing both the new state and the one before it.
  it('applies updates and notifies with next and previous state', () => {
    const store = createStateStore(makeState())
    const listener = vi.fn() // a fake function that records how it was called
    store.subscribe(listener)
    const previous = store.get()

    const next = store.update((s) => ({ ...s, invisible: true }))

    expect(store.get().invisible).toBe(true)
    expect(listener).toHaveBeenCalledExactlyOnceWith(next, previous)
  })

  // Returning the same object means "nothing changed", so listeners stay quiet.
  it('does not notify when the updater returns the same object', () => {
    const store = createStateStore(makeState())
    const listener = vi.fn()
    store.subscribe(listener)

    store.update((s) => s)

    expect(listener).not.toHaveBeenCalled()
  })

  // The function returned by subscribe() must really remove the listener.
  it('stops notifying after unsubscribe', () => {
    const store = createStateStore(makeState())
    const listener = vi.fn()
    const unsubscribe = store.subscribe(listener)

    unsubscribe()
    store.update((s) => ({ ...s, capturing: true }))

    expect(listener).not.toHaveBeenCalled()
  })

  // A crashing subscriber is logged, and the remaining subscribers still run.
  it('keeps notifying other listeners when one throws', () => {
    const store = createStateStore(makeState())
    // Silence and record console.error, so the expected error doesn't clutter the test output.
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const good = vi.fn()
    store.subscribe(() => {
      throw new Error('boom')
    })
    store.subscribe(good)

    store.update((s) => ({ ...s, invisible: true }))

    expect(good).toHaveBeenCalledOnce()
    expect(errorSpy).toHaveBeenCalledOnce()
    errorSpy.mockRestore()
  })

  // Immutability: an update creates a new object and leaves the old one untouched.
  it('never mutates the previous state object', () => {
    const initial = makeState()
    const store = createStateStore(initial)

    store.update((s) => ({ ...s, invisible: true }))

    expect(initial.invisible).toBe(false)
  })
})
