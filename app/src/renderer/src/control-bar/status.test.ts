// Unit tests for the control bar's status label (src/renderer/src/control-bar/status.ts).

import { describe, expect, it } from 'vitest'
import type { SessionStatus } from '@shared/types'
import { statusDisplay } from './status'

const ALL: SessionStatus[] = ['idle', 'starting', 'live', 'answering', 'ending']

describe('statusDisplay', () => {
  // Every session status has a label, and labels stay short enough for the 200 px pill.
  it.each(ALL)('gives %s a short label', (status) => {
    const { label } = statusDisplay(status)
    expect(label.length).toBeGreaterThan(0)
    expect(label.length).toBeLessThanOrEqual(10)
  })

  // The states the user cares most about are clearly distinguishable.
  it('distinguishes ready, listening and answering', () => {
    expect(statusDisplay('idle')).toEqual({ label: 'Ready', tone: 'idle' })
    expect(statusDisplay('live')).toEqual({ label: 'Listening', tone: 'live' })
    expect(statusDisplay('answering')).toEqual({ label: 'Answering', tone: 'answering' })
  })
})
