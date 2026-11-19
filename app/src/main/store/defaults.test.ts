// Unit tests for the default settings and initial state (src/main/store/defaults.ts).

import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, createInitialState } from './defaults'

describe('DEFAULT_SETTINGS', () => {
  // Two actions on the same key combination would conflict when hotkeys are registered (Phase 1.3).
  it('uses a different key combination for every hotkey action', () => {
    const combos = Object.values(DEFAULT_SETTINGS.hotkeys)
    expect(new Set(combos).size).toBe(combos.length)
  })
})

describe('createInitialState', () => {
  // The app should start invisible exactly when the user's setting says so.
  it('starts invisible according to the invisibleByDefault setting', () => {
    const keys = { groq: false, anthropic: false }
    expect(
      createInitialState({ ...DEFAULT_SETTINGS, invisibleByDefault: true }, keys).invisible
    ).toBe(true)
    expect(
      createInitialState({ ...DEFAULT_SETTINGS, invisibleByDefault: false }, keys).invisible
    ).toBe(false)
  })

  // On launch no session runs, nothing is being captured, and the transcript is empty.
  it('starts idle with an empty session', () => {
    const state = createInitialState(DEFAULT_SETTINGS, { groq: true, anthropic: false })
    expect(state.capturing).toBe(false)
    expect(state.session).toEqual({ status: 'idle', id: null, transcript: [], exchanges: [] })
    expect(state.keys).toEqual({ groq: true, anthropic: false })
  })
})
