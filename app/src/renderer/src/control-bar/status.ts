// Maps the session status (D-024) to what the control bar shows. Pure, so it is unit-testable.

import type { SessionStatus } from '@shared/types'

export interface StatusDisplay {
  /** Short label next to the dot. Must fit the 200 px pill. */
  label: string
  /** Dot colour class: idle (grey), busy (amber, transitions), live (green), answering (blue). */
  tone: 'idle' | 'busy' | 'live' | 'answering'
}

const DISPLAY: Record<SessionStatus, StatusDisplay> = {
  idle: { label: 'Ready', tone: 'idle' },
  starting: { label: 'Starting', tone: 'busy' },
  live: { label: 'Listening', tone: 'live' },
  answering: { label: 'Answering', tone: 'answering' },
  ending: { label: 'Stopping', tone: 'busy' }
}

export function statusDisplay(status: SessionStatus): StatusDisplay {
  return DISPLAY[status]
}
