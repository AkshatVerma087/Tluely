// Default settings and the initial AppState.
// Used until settings.json loading exists (Phase 2.1), and later as the fallback for missing fields.

import type { AppState, KeyStatus, Settings } from '@shared/types'

export const DEFAULT_SETTINGS: Settings = {
  version: 1,
  // Groq is the free default provider (D-007).
  provider: 'groq',
  // Groq model is chosen from its live /models list in Settings (Phase 2.2); empty until then.
  models: { groq: '', anthropic: 'claude-opus-5-5' },
  language: null, // auto-detect speech language
  customPrompt: '',
  invisibleByDefault: true, // start hidden from screen share
  noFocusWhenInvisible: false,
  micDeviceId: null, // system default microphone
  // Placeholder bindings; final defaults and conflict checks are done in Phase 1.3.
  hotkeys: {
    ask: 'CommandOrControl+Enter',
    toggleVisibility: 'CommandOrControl+\\',
    focusInput: 'CommandOrControl+Shift+Space',
    clear: 'CommandOrControl+Shift+R',
    toggleSession: 'CommandOrControl+Shift+S',
    moveUp: 'CommandOrControl+Up',
    moveDown: 'CommandOrControl+Down',
    moveLeft: 'CommandOrControl+Left',
    moveRight: 'CommandOrControl+Right',
    scrollUp: 'CommandOrControl+Shift+Up',
    scrollDown: 'CommandOrControl+Shift+Down'
  },
  openAtLogin: false
}

/** Builds the state the app starts with: no session running, invisible per the user's setting. */
export function createInitialState(settings: Settings, keys: KeyStatus): AppState {
  return {
    invisible: settings.invisibleByDefault,
    capturing: false,
    session: { status: 'idle', id: null, transcript: [], exchanges: [] },
    settings,
    keys
  }
}
