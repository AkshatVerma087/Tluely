// Hook: the live AppState inside any window (D-022).
//
// Reads the full state once ('state:get'), then follows every 'state:changed' event from main.
// Windows never own state: they display this and send intents (e.g. 'invisible:set') to main,
// which updates the store and pushes the new state back here.

import { useEffect, useState } from 'react'
import type { AppState } from '@shared/types'

/** The current AppState, or null until the first value arrives from main. */
export function useAppState(): AppState | null {
  const [state, setState] = useState<AppState | null>(null)

  useEffect(() => {
    let active = true

    // Subscribe first, so a change that happens while 'state:get' is in flight isn't missed.
    const stop = window.tluely.on('state:changed', (next) => {
      if (active) setState(next)
    })

    // Initial value. Only used if no 'state:changed' arrived first (that one would be newer).
    void window.tluely.invoke('state:get').then((initial) => {
      if (active) setState((current) => current ?? initial)
    })

    // Unsubscribe when the component unmounts.
    return () => {
      active = false
      stop()
    }
  }, [])

  return state
}
