// Temporary root component: an IPC self-check for the Phase 0.4 ✅ milestone.
//
// On load it verifies the whole chain page -> preload -> main -> store -> back to the page:
//   1. invoke('ping') must resolve to 'pong'                (command round trip)
//   2. invoke('state:get') returns the AppState             (main can answer with data)
//   3. invoke('invisible:set', !current) must be followed
//      by a 'state:changed' event carrying the new value    (store -> subscriber -> broadcast)
// Results are shown on screen and logged to the console ("[ipc-check] ..."), so they can also be
// checked from the terminal with ELECTRON_ENABLE_LOGGING=1. Replaced by the overlay UI in Phase 1.

import { useEffect, useState } from 'react'
import type { AppState } from '@shared/types'

type CheckStatus = 'running' | 'passed' | 'failed'

interface CheckResult {
  name: string
  status: CheckStatus
  detail?: string
}

/** Resolves with the first 'state:changed' payload, or rejects after `timeoutMs`. */
function waitForStateChange(timeoutMs: number): Promise<AppState> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      stop()
      reject(new Error(`no 'state:changed' within ${timeoutMs} ms`))
    }, timeoutMs)
    // window.tluely.on returns the function that removes the listener.
    const stop = window.tluely.on('state:changed', (state) => {
      clearTimeout(timer)
      stop()
      resolve(state)
    })
  })
}

function App(): React.JSX.Element {
  const [checks, setChecks] = useState<CheckResult[]>([])
  const [state, setState] = useState<AppState | null>(null)

  // Run the self-check once when the window opens.
  useEffect(() => {
    // React StrictMode runs effects twice in development; `cancelled` stops the first run.
    let cancelled = false

    function report(result: CheckResult): void {
      if (cancelled) return
      console.log(`[ipc-check] ${result.status.toUpperCase()} ${result.name}`, result.detail ?? '')
      setChecks((prev) => [...prev.filter((c) => c.name !== result.name), result])
    }

    async function run(): Promise<void> {
      // 1. Command round trip.
      try {
        const reply = await window.tluely.invoke('ping')
        if (cancelled) return
        report({
          name: 'ping round trip',
          status: reply === 'pong' ? 'passed' : 'failed',
          detail: `reply: ${reply}`
        })
      } catch (error) {
        report({ name: 'ping round trip', status: 'failed', detail: String(error) })
        return
      }

      // 2. Read the full state from main.
      const initial = await window.tluely.invoke('state:get')
      if (cancelled) return
      setState(initial)

      // 3. Change state in main and expect the change to arrive as an event.
      try {
        const wanted = !initial.invisible
        const changed = waitForStateChange(2000) // listen before triggering, so the event can't be missed
        await window.tluely.invoke('invisible:set', wanted)
        const received = await changed
        if (cancelled) return
        report({
          name: 'state change reaches renderer',
          status: received.invisible === wanted ? 'passed' : 'failed',
          detail: `invisible: ${initial.invisible} -> ${received.invisible}`
        })
      } catch (error) {
        report({ name: 'state change reaches renderer', status: 'failed', detail: String(error) })
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [])

  // Keep the on-screen state live for the manual toggle below.
  useEffect(() => window.tluely.on('state:changed', setState), [])

  return (
    <main className="app">
      <section className="ipc-check">
        <h1>tluely: IPC self-check</h1>
        <ul>
          {checks.map((c) => (
            <li key={c.name} className={c.status}>
              {c.status === 'passed' ? '✔' : c.status === 'failed' ? '✘' : '…'} {c.name}
              {c.detail && <small> ({c.detail})</small>}
            </li>
          ))}
        </ul>
        {state && (
          // Manual check: each click goes to main, and the new value comes back via 'state:changed'.
          <button onClick={() => window.tluely.invoke('invisible:set', !state.invisible)}>
            invisible: {String(state.invisible)} (toggle)
          </button>
        )}
      </section>
    </main>
  )
}

export default App
