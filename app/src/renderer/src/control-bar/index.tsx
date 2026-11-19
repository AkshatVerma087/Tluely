// Control bar UI (shown in the `?window=control-bar` overlay, 200x50).
//
// Left to right: session status (dot + label), invisible-mode toggle, quit.
// It only displays AppState and sends intents to main; main owns the state (D-022).
// The window isn't focusable, but Windows still delivers mouse clicks, so the buttons work
// without taking focus away from the meeting.

import { useAppState } from '../hooks/useAppState'
import { statusDisplay } from './status'

export function ControlBar(): React.JSX.Element {
  const state = useAppState()

  // Until the first state arrives, draw the empty pill so the window never flashes blank.
  if (!state) return <div className="control-bar" />

  const status = statusDisplay(state.session.status)
  const invisible = state.invisible

  return (
    <div className="control-bar">
      <span className="status" title={`Session: ${status.label}`}>
        <span className={`dot dot-${status.tone}`} aria-hidden />
        {status.label}
      </span>

      {/* Invisible = hidden from screen share. Takes effect once stealth exists (Phase 1.2). */}
      <button
        className={`icon-button ${invisible ? 'active' : ''}`}
        title={
          invisible
            ? 'Invisible: hidden from screen share (click to show)'
            : 'Visible in screen share (click to hide)'
        }
        aria-label="Toggle invisible mode"
        aria-pressed={invisible}
        onClick={() => void window.tluely.invoke('invisible:set', !invisible)}
      >
        {invisible ? <EyeOffIcon /> : <EyeIcon />}
      </button>

      <button
        className="icon-button"
        title="Quit tluely"
        aria-label="Quit tluely"
        onClick={() => void window.tluely.invoke('app:quit')}
      >
        <CloseIcon />
      </button>
    </div>
  )
}

// Small inline SVG icons (no icon library, nothing loaded from the network; CSP-safe).

function EyeIcon(): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function EyeOffIcon(): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
      <path d="M3 3l18 18" />
    </svg>
  )
}

function CloseIcon(): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  )
}
