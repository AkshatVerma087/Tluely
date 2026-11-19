// AppState store: the single source of truth in the main process (D-022).
//
// - Read with get(). Change only via update(fn), where fn returns a NEW state object (immutable).
//   Returning the same object means "no change", and nobody is notified.
// - subscribe(listener) is called after every change with (next, previous).
//   Services react to it (stealth re-applies content protection, windows receive 'state:changed').
// - Plain TypeScript, no Electron imports, so it is unit-testable.

import type { AppState } from '@shared/types'

export type StateListener = (next: AppState, previous: AppState) => void
export type StateUpdater = (current: AppState) => AppState

export interface StateStore {
  get(): AppState
  /** Applies `fn` and notifies subscribers if the state object changed. Returns the new state. */
  update(fn: StateUpdater): AppState
  /** Registers a listener for changes. Returns a function that unsubscribes it. */
  subscribe(listener: StateListener): () => void
}

export function createStateStore(initial: AppState): StateStore {
  let state = initial
  const listeners = new Set<StateListener>()

  return {
    get: () => state,

    update(fn) {
      const previous = state
      const next = fn(previous)
      if (next === previous) return state

      state = next
      // Iterate over a copy, so a listener that (un)subscribes during notification is safe.
      for (const listener of [...listeners]) {
        try {
          listener(next, previous)
        } catch (error) {
          // One failing subscriber must not stop the others.
          console.error('[state] subscriber threw:', error)
        }
      }
      return state
    },

    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    }
  }
}
